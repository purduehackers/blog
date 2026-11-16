import type { APIRoute } from "astro";
import { finishLogin } from "../../lib/admin/auth";
export const prerender = false;
export const GET: APIRoute = finishLogin;
