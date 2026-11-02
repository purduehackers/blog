import https from "node:https";
import { AdminSetupError, required, setting } from "./config.ts";

export async function exchangeIdCode(
  code: string,
  verifier: string,
  redirectUri: string,
): Promise<Response> {
  const clientId = required("PH_ID_CLIENT_ID");
  const secret = required("PH_ID_CLIENT_SECRET");
  const method = setting("PH_ID_TOKEN_AUTH_METHOD", "client_secret_basic");
  if (!["client_secret_basic", "client_secret_post"].includes(method)) {
    throw new AdminSetupError(
      "Set PH_ID_TOKEN_AUTH_METHOD to client_secret_basic (the ID app default) or client_secret_post to match your registered application.",
    );
  }
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    code_verifier: verifier,
    client_id: clientId,
    redirect_uri: redirectUri,
  });
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (method === "client_secret_basic") {
    const encode = (value: string) =>
      new URLSearchParams({ value }).toString().slice("value=".length);
    headers.Authorization = `Basic ${Buffer.from(`${encode(clientId)}:${encode(secret)}`).toString("base64")}`;
  } else body.set("client_secret", secret);
  const payload = body.toString();
  headers["Content-Length"] = String(Buffer.byteLength(payload));

  // ID exempts authenticated server OAuth requests from browser CSRF checks only
  // when browser Fetch Metadata is absent. Node fetch adds Sec-Fetch-Mode: cors,
  // so use the native server HTTPS client. Never spoof Origin or send cookies.
  return new Promise((resolve, reject) => {
    const request = https.request(
      "https://id.purduehackers.com/api/auth/oauth2/token",
      {
        method: "POST",
        headers,
        timeout: 8000,
      },
      (response) => {
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > 65536) {
            request.destroy(
              new Error("ID token response exceeded its size limit."),
            );
            return;
          }
          chunks.push(chunk);
        });
        response.on("error", reject);
        response.on("end", () =>
          resolve(
            new Response(Buffer.concat(chunks), {
              status: response.statusCode || 502,
            }),
          ),
        );
      },
    );
    // A socket inactivity timeout alone does not bound a slowly streaming reply.
    const deadline = setTimeout(
      () => request.destroy(new Error("ID token exchange timed out.")),
      8000,
    );
    request.on("close", () => clearTimeout(deadline));
    request.on("timeout", () =>
      request.destroy(new Error("ID token exchange timed out.")),
    );
    request.on("error", (error) => {
      clearTimeout(deadline);
      reject(error);
    });
    request.end(payload);
  });
}
