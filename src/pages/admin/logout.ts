import type { APIRoute } from "astro";
import { logout } from "../../lib/admin/auth";
export const prerender = false;
export const POST: APIRoute = logout;
