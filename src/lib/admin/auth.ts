import type { APIContext } from "astro";
import { createHash } from "node:crypto";
import { required, setting, siteOrigin } from "./config.ts";
import {
  decrypt,
  digest,
  encrypt,
  key,
  opaque,
  read,
  redis,
  write,
} from "./store.ts";

const provider = "https://id.purduehackers.com/api/auth/oauth2";
const sessionCookie = "ph_newsletter_session";
const flowCookie = "ph_newsletter_oauth";
interface Session {
  token: string;
  sub: string;
  expires: number;
}
export interface Admin {
  sub: string;
  name: string;
}
export class AdminError extends Error {
  status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.status = status;
  }
}
function cookieOptions() {
  return {
    path: "/",
    httpOnly: true,
    secure: siteOrigin().startsWith("https:"),
    sameSite: "lax" as const,
  };
}
export async function identity(token: string): Promise<Admin> {
  const response = await fetch(`${provider}/userinfo`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok)
    throw new AdminError("Your sign-in expired. Sign in again.", 401);
  const user = (await response.json()) as {
    sub?: string;
    name?: string;
    preferred_username?: string;
    roles?: unknown;
  };
  const role = setting("PH_ID_REQUIRED_ROLE", "organizer");
  if (!["organizer", "admin", "alumni"].includes(role))
    throw new Error("Invalid PH_ID_REQUIRED_ROLE.");
  if (!user.sub || !Array.isArray(user.roles) || !user.roles.includes(role)) {
    throw new AdminError(`This page requires the Purdue Hackers ${role} role.`);
  }
  return {
    sub: user.sub,
    name: user.name || user.preferred_username || "Organizer",
  };
}
export async function requireAdmin(
  context: Pick<APIContext, "cookies">,
): Promise<Admin> {
  const id = context.cookies.get(sessionCookie)?.value;
  if (!id || !/^[A-Za-z0-9_-]{43}$/.test(id))
    throw new AdminError("Sign in to continue.", 401);
  const session = await read<Session>(`session:${digest(id)}`);
  if (!session || session.expires <= Date.now())
    throw new AdminError("Your sign-in expired. Sign in again.", 401);
  // Ask ID on every privileged request, including every send continuation.
  const user = await identity(decrypt(session.token));
  if (user.sub !== session.sub) throw new AdminError("Invalid session.", 401);
  return user;
}
export function requireSameOrigin(request: Request): void {
  if (request.headers.get("origin") !== siteOrigin())
    throw new AdminError("Submit this action from the admin page.");
}
export async function beginLogin(context: APIContext): Promise<Response> {
  const state = opaque();
  const verifier = opaque();
  await write(`oauth:${digest(state)}`, { verifier }, 600);
  context.cookies.set(flowCookie, state, { ...cookieOptions(), maxAge: 600 });
  const query = new URLSearchParams({
    client_id: required("PH_ID_CLIENT_ID"),
    response_type: "code",
    redirect_uri: `${siteOrigin()}/admin/callback`,
    scope: "openid profile roles",
    state,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
  });
  return context.redirect(`${provider}/authorize?${query}`, 302);
}
export async function finishLogin(context: APIContext): Promise<Response> {
  const state = context.url.searchParams.get("state");
  const expected = context.cookies.get(flowCookie)?.value;
  context.cookies.delete(flowCookie, { path: "/" });
  if (!state || !expected || state !== expected)
    throw new AdminError("Invalid sign-in state. Start again.");
  const flowKey = key(`oauth:${digest(state)}`);
  const saved = await redis<string | null>("GETDEL", flowKey);
  if (!saved) throw new AdminError("Sign-in expired. Start again.");
  const { verifier } = JSON.parse(saved) as { verifier: string };
  const code = context.url.searchParams.get("code");
  if (!code || context.url.searchParams.has("error"))
    throw new AdminError("Sign-in was declined.");
  const response = await fetch(`${provider}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      code_verifier: verifier,
      client_id: required("PH_ID_CLIENT_ID"),
      client_secret: required("PH_ID_CLIENT_SECRET"),
      redirect_uri: `${siteOrigin()}/admin/callback`,
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok)
    throw new AdminError(
      "Could not complete sign-in. Check the ID application configuration.",
      401,
    );
  const token = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!token.access_token)
    throw new AdminError("ID did not return an access token.", 401);
  const user = await identity(token.access_token);
  const ttl = Math.min(token.expires_in || 3600, 3600);
  const id = opaque();
  await write(
    `session:${digest(id)}`,
    {
      token: encrypt(token.access_token),
      sub: user.sub,
      expires: Date.now() + ttl * 1000,
    },
    ttl,
  );
  context.cookies.set(sessionCookie, id, { ...cookieOptions(), maxAge: ttl });
  return context.redirect("/admin", 303);
}
export async function logout(context: APIContext): Promise<Response> {
  requireSameOrigin(context.request);
  const id = context.cookies.get(sessionCookie)?.value;
  if (id) await redis("DEL", key(`session:${digest(id)}`));
  context.cookies.delete(sessionCookie, { path: "/" });
  return context.redirect("/admin", 303);
}
