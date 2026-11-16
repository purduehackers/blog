import { mkdir, open, readFile, rename, rm } from "node:fs/promises";
import { rmSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { join } from "node:path";
import { encrypt, decrypt } from "../../src/lib/admin/store.ts";

const scope =
  "offline_access https://graph.microsoft.com/User.Read https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/Calendars.ReadWrite";
interface Credential {
  email: string;
  clientId: string;
  tenantId: string;
  access: string;
  refresh: string;
  expires: number;
}
interface Tokens {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
}
export function email(value: string | undefined): string {
  if (!value || !/^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(value))
    throw new Error("Provide one valid email address.");
  return value.toLowerCase();
}

export class MailClient {
  private directory: string;
  private clientId: string;
  private tenantId: string;
  private request: typeof fetch;
  private wait: (ms: number) => Promise<void>;
  constructor(
    directory: string,
    clientId: string,
    tenantId: string,
    request: typeof fetch = fetch,
    wait = (ms: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, ms)),
  ) {
    this.directory = directory;
    this.clientId = clientId;
    this.tenantId = tenantId;
    this.request = request;
    this.wait = wait;
  }
  private file(account: string) {
    return join(
      this.directory,
      createHash("sha256").update(account).digest("hex") + ".enc",
    );
  }
  async locked<T>(account: string, action: () => Promise<T>): Promise<T> {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const lock = this.file(account) + ".lock";
    let handle;
    try {
      handle = await open(lock, "wx", 0o600);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST")
        throw new Error(
          `Another mail command is running for this account. If it crashed, stop it before removing ${lock}.`,
        );
      throw error;
    }
    const releaseOnExit = () => {
      try {
        rmSync(lock, { force: true });
      } catch {
        /* Best effort during exit. */
      }
    };
    const interrupt = () => process.exit(130);
    const terminate = () => process.exit(143);
    process.once("exit", releaseOnExit);
    process.once("SIGINT", interrupt);
    process.once("SIGTERM", terminate);
    try {
      return await action();
    } finally {
      await handle.close();
      await rm(lock, { force: true });
      process.removeListener("exit", releaseOnExit);
      process.removeListener("SIGINT", interrupt);
      process.removeListener("SIGTERM", terminate);
    }
  }
  private async save(account: string, credential: Credential) {
    const file = this.file(account);
    const temporary = file + "." + randomUUID() + ".tmp";
    try {
      const handle = await open(temporary, "wx", 0o600);
      try {
        await handle.writeFile(encrypt(JSON.stringify(credential)));
        await handle.sync();
      } finally {
        await handle.close();
      }
      await rename(temporary, file);
    } finally {
      await rm(temporary, { force: true });
    }
  }
  private async saved(account: string): Promise<Credential> {
    let value: string;
    try {
      value = await readFile(this.file(account), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        throw new Error(
          `Connect ${account} first. Run: npm run mail -- auth --account '${account}'`,
        );
      throw error;
    }
    const saved = JSON.parse(decrypt(value)) as Credential;
    if (
      saved.email !== account ||
      saved.clientId !== this.clientId ||
      saved.tenantId !== this.tenantId
    )
      throw new Error(
        "Saved account belongs to another app or tenant. Authenticate again.",
      );
    return saved;
  }
  private endpoint(path: string) {
    return `https://login.microsoftonline.com/${encodeURIComponent(this.tenantId)}/oauth2/v2.0/${path}`;
  }
  private async token(parameters: Record<string, string>): Promise<Tokens> {
    const response = await this.request(this.endpoint("token"), {
      method: "POST",
      body: new URLSearchParams({ client_id: this.clientId, ...parameters }),
      signal: AbortSignal.timeout(10000),
    });
    const tokens = (await response.json()) as Tokens;
    if (
      !response.ok &&
      !["authorization_pending", "slow_down"].includes(tokens.error || "")
    )
      throw new Error(
        `Microsoft authentication failed (${tokens.error || response.status}). Run auth again if access was revoked or expired.`,
      );
    return tokens;
  }
  private async verify(access: string, account: string) {
    const response = await this.graph(
      access,
      "/me?$select=mail,userPrincipalName",
    );
    const user = (await response.json()) as {
      mail?: string;
      userPrincipalName?: string;
    };
    if ((user.mail || user.userPrincipalName || "").toLowerCase() !== account)
      throw new Error(
        `Sign-in must match ${account}. The existing connection was preserved.`,
      );
  }
  async auth(account: string, log = console.log) {
    if (!account.endsWith("@purdue.edu"))
      throw new Error("Use a Purdue email account with this app.");
    const response = await this.request(this.endpoint("devicecode"), {
      method: "POST",
      body: new URLSearchParams({ client_id: this.clientId, scope }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok)
      throw new Error(
        `Could not start Microsoft sign-in (${response.status}).`,
      );
    const flow = (await response.json()) as {
      message: string;
      device_code: string;
      expires_in: number;
      interval?: number;
    };
    log(
      `Sign in as ${account}. Consent includes mail reading/writing, sending, and calendar access, matching the registered app permissions.\n${flow.message}`,
    );
    const deadline = Date.now() + flow.expires_in * 1000;
    let interval = Math.max(flow.interval || 5, 5);
    while (Date.now() < deadline) {
      await this.wait(interval * 1000);
      const tokens = await this.token({
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        device_code: flow.device_code,
      });
      if (tokens.error === "authorization_pending") continue;
      if (tokens.error === "slow_down") {
        interval += 5;
        continue;
      }
      if (!tokens.access_token || !tokens.refresh_token || !tokens.expires_in)
        throw new Error(
          "Microsoft did not return a reusable connection. Check offline_access consent.",
        );
      await this.verify(tokens.access_token, account);
      await this.save(account, {
        email: account,
        clientId: this.clientId,
        tenantId: this.tenantId,
        access: tokens.access_token,
        refresh: tokens.refresh_token,
        expires: Date.now() + tokens.expires_in * 1000 - 60000,
      });
      log(
        `Connected ${account}. Encrypted credentials saved locally; future commands refresh automatically.`,
      );
      return;
    }
    throw new Error("Microsoft sign-in expired. Run auth again.");
  }
  private async access(account: string): Promise<string> {
    const saved = await this.saved(account);
    if (saved.expires > Date.now()) return saved.access;
    const tokens = await this.token({
      grant_type: "refresh_token",
      refresh_token: saved.refresh,
      scope,
    });
    if (!tokens.access_token || !tokens.expires_in)
      throw new Error("Could not refresh connection. Run auth again.");
    saved.access = tokens.access_token;
    saved.refresh = tokens.refresh_token || saved.refresh;
    saved.expires = 0;
    // Persist token rotation before any mailbox operation, even if verification fails.
    await this.save(account, saved);
    await this.verify(saved.access, account);
    saved.expires = Date.now() + tokens.expires_in * 1000 - 60000;
    await this.save(account, saved);
    return saved.access;
  }
  private async graph(access: string, path: string, init: RequestInit = {}) {
    const response = await this.request(
      `https://graph.microsoft.com/v1.0${path}`,
      {
        ...init,
        headers: {
          Authorization: `Bearer ${access}`,
          "Content-Type": "application/json",
          Prefer: 'outlook.body-content-type="text"',
          ...init.headers,
        },
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!response.ok)
      throw new Error(
        `Microsoft Graph returned HTTP ${response.status}.${response.status === 403 ? " Check Mail.ReadWrite and Mail.Send delegated consent and Purdue access policies." : ""}`,
      );
    return response;
  }
  async list(
    account: string,
    folder: string,
    limit: number,
    skip: number,
    search?: string,
  ) {
    const query = new URLSearchParams({
      $top: String(limit),
      $skip: String(skip),
      $select:
        "id,subject,from,toRecipients,receivedDateTime,isRead,bodyPreview,webLink",
    });
    if (search) query.set("$search", JSON.stringify(search));
    else query.set("$orderby", "receivedDateTime desc");
    const response = await this.graph(
      await this.access(account),
      `/me/mailFolders/${encodeURIComponent(folder)}/messages?${query}`,
    );
    return response.json();
  }
  async read(account: string, id: string) {
    const response = await this.graph(
      await this.access(account),
      `/me/messages/${encodeURIComponent(id)}?$select=id,subject,from,toRecipients,ccRecipients,receivedDateTime,body,webLink`,
    );
    return response.json();
  }
  async send(account: string, to: string, subject: string, body: string) {
    const access = await this.access(account);
    await this.verify(access, account);
    let response: Response;
    try {
      response = await this.graph(access, "/me/sendMail", {
        method: "POST",
        body: JSON.stringify({
          message: {
            from: { emailAddress: { address: account } },
            toRecipients: [{ emailAddress: { address: to } }],
            subject,
            body: { contentType: "Text", content: body },
          },
          saveToSentItems: true,
        }),
      });
    } catch (error) {
      throw new Error(
        `${error instanceof Error ? error.message : "Send failed."} Check Sent Items before retrying; this command never retries a send automatically.`,
      );
    }
    if (response.status !== 202)
      throw new Error(
        `Unexpected send status ${response.status}. Check Sent Items before retrying.`,
      );
    return {
      accepted: true,
      from: account,
      to,
      subject,
      note: "Accepted for processing, not confirmed delivery.",
    };
  }
  async forward(account: string, id: string, to: string) {
    const access = await this.access(account);
    await this.verify(access, account);
    let response: Response;
    try {
      response = await this.graph(
        access,
        `/me/messages/${encodeURIComponent(id)}/forward`,
        {
          method: "POST",
          body: JSON.stringify({
            toRecipients: [{ emailAddress: { address: email(to) } }],
          }),
        },
      );
    } catch (error) {
      throw new Error(
        `${error instanceof Error ? error.message : "Forward failed."} Check Sent Items before retrying; forwards are never automatically retried.`,
      );
    }
    if (response.status !== 202)
      throw new Error(
        `Unexpected forward status ${response.status}. Check Sent Items before retrying.`,
      );
    return { accepted: true, from: account, to, originalId: id };
  }
  async disconnect(account: string) {
    await rm(this.file(account), { force: true });
    return {
      disconnected: account,
      note: "Local credentials removed. This does not revoke Microsoft consent.",
    };
  }
}
