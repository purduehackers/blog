import type { APIRoute } from "astro";
import { randomUUID } from "node:crypto";
import {
  recordClick,
  verifyClick,
  type ClickSource,
} from "../../lib/admin/clicks";
export const prerender = false;
export const GET: APIRoute = async ({ url, cookies, request }) => {
  const edition = url.searchParams.get("edition") || "";
  const source = url.searchParams.get("source") || "";
  const destination = url.searchParams.get("url") || "";
  if (
    !verifyClick(
      edition,
      source,
      destination,
      url.searchParams.get("signature") || "",
    )
  )
    return new Response("Invalid newsletter link", { status: 400 });
  if (
    !/bot|crawler|spider|preview|scanner/i.test(
      request.headers.get("user-agent") || "",
    ) &&
    request.headers.get("purpose") !== "prefetch" &&
    request.headers.get("sec-purpose") !== "prefetch"
  ) {
    const previous = cookies.get("newsletter_visitor")?.value;
    const visitor =
      previous && /^[a-f\d-]{36}$/.test(previous) ? previous : randomUUID();
    cookies.set("newsletter_visitor", visitor, {
      path: "/",
      httpOnly: true,
      secure: url.protocol === "https:",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
    try {
      await recordClick(edition, source as ClickSource, destination, visitor);
    } catch {
      console.error("Newsletter click could not be recorded");
    }
  }
  return new Response(null, {
    status: 302,
    headers: {
      Location: destination,
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
};
