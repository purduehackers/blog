import type { APIRoute } from "astro";
import { subscribe } from "../../lib/newsletter";
import { getNewsletterConfig } from "../../lib/notion-mailing-list";

export const prerender = false;
export const POST: APIRoute = ({ request }) =>
  subscribe(request, getNewsletterConfig());
