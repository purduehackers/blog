import type { APIRoute } from "astro";
import { randomUUID } from "node:crypto";
import { validId } from "../../lib/admin/campaigns";
import { saveRating, verifyRatingToken } from "../../lib/admin/ratings";
export const prerender = false;
export const POST: APIRoute = async ({ request, cookies }) => {
  const reply = (message: string, status = 200) => new Response(JSON.stringify({ message }), {
    status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return reply("Please rate from the newsletter link.", 403);
  try {
    const body = await request.text();
    if (body.length > 1024) return reply("Invalid rating.", 400);
    const input = JSON.parse(body);
    if (!input || !validId(input.edition || "") || ![1, 3, 5].includes(input.score))
      return reply("Choose 1, 3, or 5 flames.", 400);
    let voter: string;
    if (input.token) {
      if (typeof input.token !== "string") return reply("Invalid rating link.", 400);
      const token = verifyRatingToken(input.edition, input.token);
      if (!token) return reply("Invalid rating link.", 400);
      voter = `email:${token}`;
    } else {
      let visitor = cookies.get("newsletter-voter")?.value;
      if (!visitor || !validId(visitor)) visitor = randomUUID();
      cookies.set("newsletter-voter", visitor, { path: "/", httpOnly: true, secure: new URL(request.url).protocol === "https:", sameSite: "lax", maxAge: 31536000 });
      voter = `browser:${visitor}`;
    }
    if (!await saveRating(input.edition, voter, input.score)) return reply("Newsletter not found.", 404);
    return reply("Thanks! Your rating has been saved.");
  } catch {
    return reply("We couldn't save your rating. Please try again.", 503);
  }
};
