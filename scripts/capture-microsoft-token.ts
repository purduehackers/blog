/** One-time device login. Never logs or writes tokens to a local file. */
import { sql, closeDatabase } from "../src/lib/admin/database.ts";
import { required, sender } from "../src/lib/admin/config.ts";
import {
  microsoftEndpoint,
  microsoftConsentScope,
  seedMicrosoftToken,
} from "../src/lib/admin/microsoft.ts";

async function main() {
  // Validate all storage configuration before asking anyone to sign in.
  for (const name of [
    "MICROSOFT_CLIENT_ID",
    "MICROSOFT_TENANT_ID",
    "NEWSLETTER_ENCRYPTION_KEY",
  ])
    required(name);
  await sql("SELECT version FROM newsletter_schema_migrations WHERE version=1");
  const clientId = required("MICROSOFT_CLIENT_ID");
  const started = await fetch(microsoftEndpoint("devicecode"), {
    method: "POST",
    body: new URLSearchParams({
      client_id: clientId,
      scope: microsoftConsentScope,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!started.ok)
    throw new Error(
      `Could not start Microsoft login (${started.status}). Check the app registration and public client flows setting.`,
    );
  const flow = (await started.json()) as {
    message: string;
    device_code: string;
    expires_in: number;
    interval?: number;
  };
  console.log(
    `Sign in as ${sender()}. Consent includes mail sending and calendar event access for future features.\n${flow.message}`,
  );
  const deadline = Date.now() + flow.expires_in * 1000;
  let interval = Math.max(flow.interval || 5, 5);
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, interval * 1000));
    const response = await fetch(microsoftEndpoint("token"), {
      method: "POST",
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        device_code: flow.device_code,
      }),
      signal: AbortSignal.timeout(10000),
    });
    const token = (await response.json()) as {
      error?: string;
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };
    if (response.ok && token.access_token && token.refresh_token) {
      await seedMicrosoftToken(token);
      console.log(
        `Connected ${sender()}. The encrypted credential is stored in Turso. No email was sent.`,
      );
      return;
    }
    if (token.error === "authorization_pending") continue;
    if (token.error === "slow_down") {
      interval += 5;
      continue;
    }
    throw new Error(
      `Microsoft login failed (${token.error || response.status}). Check consent and try again.`,
    );
  }
  throw new Error("Microsoft login expired. Run the script again.");
}
main()
  .catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : "Microsoft connection failed.",
    );
    process.exitCode = 1;
  })
  .finally(closeDatabase);
