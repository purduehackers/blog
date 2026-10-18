import type { APIRoute } from "astro";
import { unsubscribe } from "../../lib/unsubscribe";
import { getNewsletterConfig } from "../../lib/notion-mailing-list";

export const prerender = false;
export const POST: APIRoute = ({ request }) =>
  unsubscribe(request, getNewsletterConfig());
