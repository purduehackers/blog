import { required, sender } from "./config.ts";
import { decrypt, encrypt, locked, read, write } from "./store.ts";

export const microsoftScope =
  "offline_access https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read";
export interface MicrosoftCredential {
  refresh: string;
  access: string;
  expires: number;
  email: string;
}
export function microsoftEndpoint(path: string): string {
  return `https://login.microsoftonline.com/${encodeURIComponent(required("MICROSOFT_TENANT_ID"))}/oauth2/v2.0/${path}`;
}
export async function verifyMailbox(accessToken: string): Promise<string> {
  const response = await fetch(
    "https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(8000),
    },
  );
  if (!response.ok)
    throw new Error(
      `Could not verify the Microsoft mailbox (${response.status}).`,
    );
  const user = (await response.json()) as {
    mail?: string;
    userPrincipalName?: string;
  };
  const email = (user.mail || user.userPrincipalName || "").toLowerCase();
  if (email !== sender())
    throw new Error(
      `Sign in as ${sender()} when capturing the Microsoft token.`,
    );
  return email;
}
export async function seedMicrosoftToken(token: {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}): Promise<void> {
  const email = await verifyMailbox(token.access_token);
  await locked("microsoft", async () => {
    await write("microsoft", {
      refresh: encrypt(token.refresh_token),
      access: encrypt(token.access_token),
      expires: Date.now() + token.expires_in * 1000 - 60000,
      email,
    } satisfies MicrosoftCredential);
  });
}
export async function graphAccessToken(): Promise<string> {
  return locked("microsoft", async () => {
    const saved = await read<MicrosoftCredential>("microsoft");
    if (!saved || saved.email !== sender())
      throw new Error(
        "Connect the sender by running the Microsoft token capture script.",
      );
    if (saved.expires > Date.now()) return decrypt(saved.access);
    const response = await fetch(microsoftEndpoint("token"), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: required("MICROSOFT_CLIENT_ID"),
        grant_type: "refresh_token",
        refresh_token: decrypt(saved.refresh),
        scope: microsoftScope,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok)
      throw new Error(
        `Microsoft authorization failed (${response.status}). Reconnect the mailbox with the capture script if consent was revoked.`,
      );
    const token = (await response.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in: number;
    };
    if (!token.access_token)
      throw new Error("Microsoft returned no access token.");
    // Persist rotation BEFORE any mail is sent, including across cold starts.
    const rotated = {
      refresh: token.refresh_token
        ? encrypt(token.refresh_token)
        : saved.refresh,
      access: encrypt(token.access_token),
      expires: 0,
      email: saved.email,
    } satisfies MicrosoftCredential;
    await write("microsoft", rotated);
    await verifyMailbox(token.access_token);
    rotated.expires = Date.now() + token.expires_in * 1000 - 60000;
    await write("microsoft", rotated);
    return token.access_token;
  });
}
export class DeliveryError extends Error {
  uncertain: boolean;
  constructor(message: string, uncertain: boolean) {
    super(message);
    this.uncertain = uncertain;
  }
}
export async function sendEmail(
  accessToken: string,
  to: string,
  subject: string,
  html: string,
): Promise<void> {
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
          subject,
          body: { contentType: "HTML", content: html },
          toRecipients: [{ emailAddress: { address: to } }],
        },
        saveToSentItems: true,
      }),
      signal: AbortSignal.timeout(12000),
    });
  } catch {
    throw new DeliveryError(
      "Microsoft did not confirm the send. Review Sent Items before retrying.",
      true,
    );
  }
  if (response.status !== 202) {
    throw new DeliveryError(
      `Microsoft did not accept the email (${response.status}).${response.status === 429 ? " Wait before resuming; the mailbox is rate limited." : ""}`,
      response.status >= 500,
    );
  }
}
