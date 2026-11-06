import type { APIRoute } from "astro";
import { beginLogin } from "../../lib/admin/auth";
export const prerender = false;
export const GET: APIRoute = beginLogin;
