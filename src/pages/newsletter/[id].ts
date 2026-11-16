import type { APIRoute } from "astro";
import { validId } from "../../lib/admin/campaigns";
export const prerender = false;
export const GET: APIRoute = ({ params, redirect }) =>
  validId(params.id || "")
    ? redirect(`/posts/${params.id}`, 301)
    : new Response("Post not found", { status: 404 });
