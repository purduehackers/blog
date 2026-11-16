import { createClient, type Client, type InStatement } from "@libsql/client";
import { AdminSetupError, required, setting } from "./config.ts";

let client: Client | undefined;
let configuration = "";
export function database(): Client {
  // Vercel allows integrations to namespace their variables. Keep each URL
  // paired with its own token rather than mixing credentials from two databases.
  const prefix = setting("BLOG_STORAGE_TURSO_DATABASE_URL")
    ? "BLOG_STORAGE_"
    : "";
  const originalUrl = required(`${prefix}TURSO_DATABASE_URL`);
  const local = originalUrl.startsWith("file:");
  if (local && setting("VERCEL"))
    throw new Error(
      "Vercel requires a remote Turso database, not a local SQLite file.",
    );
  const url = local ? originalUrl : originalUrl.replace(/^libsql:/, "https:");
  if (!local && new URL(url).protocol !== "https:")
    throw new Error("Turso must use libsql:// or https://.");
  const authToken = local ? undefined : required(`${prefix}TURSO_AUTH_TOKEN`);
  const next = JSON.stringify([url, authToken]);
  if (!client || configuration !== next) {
    client?.close();
    client = createClient({
      url,
      ...(authToken ? { authToken } : {}),
      fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        return fetch(request, {
          signal: AbortSignal.any([request.signal, AbortSignal.timeout(8000)]),
        });
      },
    });
    configuration = next;
  }
  return client;
}
export function closeDatabase(): void {
  client?.close();
  client = undefined;
  configuration = "";
}
// Write-mode transactions route reads to the primary, too. A new serverless
// instance must observe earlier delivery claims, consumed states and leases.
// Transactions end before any call to Microsoft or Notion.
export async function batch(
  statements: InStatement[],
  mode: "write" = "write",
) {
  try {
    return await database().batch(statements, mode);
  } catch (error) {
    if (
      error instanceof Error &&
      /no such table:\s*(?:main\.)?newsletter_/i.test(error.message)
    ) {
      throw new AdminSetupError(
        "The newsletter database has not been initialized. Run npm run newsletter:setup for this environment, then try signing in again.",
      );
    }
    throw error;
  }
}
export async function sql(statement: InStatement) {
  return (await batch([statement]))[0]!;
}
