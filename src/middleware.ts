import { defineMiddleware } from "astro:middleware";
import { AdminError, requireAdmin, requireSameOrigin } from "./lib/admin/auth";

export const onRequest = defineMiddleware(async (context, next) => {
  const path = context.url.pathname.replace(/\/$/, "");
  if (
    !(
      path === "/admin" ||
      path.startsWith("/admin/") ||
      path === "/api/admin" ||
      path.startsWith("/api/admin/")
    )
  )
    return next();
  try {
    if (context.request.method !== "GET" && context.request.method !== "HEAD")
      requireSameOrigin(context.request);
    if (!["/admin/login", "/admin/callback", "/admin/logout"].includes(path)) {
      try {
        context.locals.admin = await requireAdmin(context);
      } catch (error) {
        if (path === "/admin" && error instanceof AdminError)
          context.locals.adminError = error.message;
        else throw error;
      }
    }
    const response = await next();
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    response.headers.set("Referrer-Policy", "same-origin");
    response.headers.set("X-Frame-Options", "DENY");
    return response;
  } catch (error) {
    const status = error instanceof AdminError ? error.status : 503;
    const message =
      error instanceof AdminError
        ? error.message
        : "Newsletter administration is unavailable. Check the server configuration and try again.";
    return new Response(JSON.stringify({ message }), {
      status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  }
});
