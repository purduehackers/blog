/** Send one plain-text email; never reads the subscriber list. */
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import { closeDatabase } from "../src/lib/admin/database.ts";
import { required, sender } from "../src/lib/admin/config.ts";
import {
  graphAccessToken,
  microsoftEndpoint,
} from "../src/lib/admin/microsoft.ts";

const help = `Send one plain-text test email:
  npm run newsletter:test-email -- --from phackers@purdue.edu --to you@purdue.edu --subject "Test" --body "Hello!"

Options:
  --from       Sender's Purdue email address (required)
  --to         One recipient email address (required)
  --subject    Email subject (required)
  --body       Plain-text email body (required)
  --login      Sign in separately as --from; credentials stay in memory only
  --help       Show this help without connecting or sending

Without --login, uses the saved newsletter mailbox connection.
--from must match the authenticated mailbox; shared mailbox sending is not supported.
`;

function email(value: string | undefined, flag: string): string {
  if (!value || !/^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(value))
    throw new Error(`Provide one valid email address for --${flag}.`);
  return value.toLowerCase();
}

async function login(from: string): Promise<string> {
  const scope =
    "https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read";
  const clientId = required("MICROSOFT_CLIENT_ID");
  const started = await fetch(microsoftEndpoint("devicecode"), {
    method: "POST",
    body: new URLSearchParams({ client_id: clientId, scope }),
    signal: AbortSignal.timeout(10000),
  });
  if (!started.ok)
    throw new Error(`Could not start Microsoft sign-in (${started.status}).`);
  const flow = (await started.json()) as {
    message: string;
    device_code: string;
    expires_in: number;
    interval?: number;
  };
  console.log(
    `Sign in as ${from}. This test requests mail sending and profile access.\n${flow.message}`,
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
      access_token?: string;
      error?: string;
    };
    if (response.ok && token.access_token) return token.access_token;
    if (token.error === "authorization_pending") continue;
    if (token.error === "slow_down") {
      interval += 5;
      continue;
    }
    throw new Error(
      `Microsoft sign-in failed (${token.error || response.status}).`,
    );
  }
  throw new Error("Microsoft sign-in expired. Run the script again.");
}

export async function main(args = process.argv.slice(2)): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      from: { type: "string" },
      to: { type: "string" },
      subject: { type: "string" },
      body: { type: "string" },
      login: { type: "boolean" },
      help: { type: "boolean" },
    },
  });
  if (values.help) {
    console.log(help);
    return;
  }
  const from = email(values.from, "from");
  const to = email(values.to, "to");
  if (!from.endsWith("@purdue.edu"))
    throw new Error("--from must be a purdue.edu mailbox.");
  if (!values.subject?.trim() || /[\r\n]/.test(values.subject))
    throw new Error("Provide a nonempty, single-line --subject.");
  if (!values.body?.trim()) throw new Error("Provide a nonempty --body.");
  if (!values.login && from !== sender())
    throw new Error(
      "--from must match MICROSOFT_SENDER_EMAIL, or use --login for a separate account.",
    );
  const accessToken = values.login
    ? await login(from)
    : await graphAccessToken();
  const profile = await fetch(
    "https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!profile.ok)
    throw new Error(`Could not verify sender (${profile.status}).`);
  const user = (await profile.json()) as {
    mail?: string;
    userPrincipalName?: string;
  };
  if ((user.mail || user.userPrincipalName || "").toLowerCase() !== from)
    throw new Error(
      `The signed-in mailbox does not match ${from}. No email was sent.`,
    );
  let response: Response;
  try {
    response = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          from: { emailAddress: { address: from } },
          toRecipients: [{ emailAddress: { address: to } }],
          subject: values.subject,
          body: { contentType: "Text", content: values.body },
        },
        saveToSentItems: true,
      }),
      signal: AbortSignal.timeout(12000),
    });
  } catch {
    throw new Error(
      "Send result is unknown. Check Sent Items before retrying.",
    );
  }
  if (response.status !== 202)
    throw new Error(
      `Microsoft returned HTTP ${response.status}. Check Sent Items before retrying.`,
    );
  console.log(
    `Microsoft accepted one email from ${from} to ${to}. Check the inbox and sender's Sent Items; acceptance does not confirm delivery.`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main()
    .catch((error) => {
      console.error(
        error instanceof Error ? error.message : "Test email failed.",
      );
      process.exitCode = 1;
    })
    .finally(closeDatabase);
}
