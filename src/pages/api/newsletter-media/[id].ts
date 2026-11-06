import type { APIRoute } from "astro";
import { validId } from "../../../lib/admin/campaigns";
import { getMedia, getEdition } from "../../../lib/admin/store";
export const prerender = false;
export const GET: APIRoute = async ({ params }) => {
  if (!validId(params.id || ""))
    return new Response("Not found", { status: 404 });
  const media = await getMedia(params.id!);
  if (!media) return new Response("Not found", { status: 404 });
  const edition = await getEdition(media.campaignId);
  // Unpublished media uses an unguessable ID, so test-email clients can load it.
  return new Response(Buffer.from(media.body, "base64"), {
    headers: {
      "Content-Type": media.type,
      "Cache-Control": edition?.publishedAt
        ? "public, max-age=31536000, immutable"
        : "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex",
    },
  });
};
