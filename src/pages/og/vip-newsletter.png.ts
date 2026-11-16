import type { APIRoute } from "astro";

import { renderIndexOg } from "lib/og";

export const GET: APIRoute = async () => {
  const png = await renderIndexOg({
    title: "VIP Newsletter",
    caption: "Purdue Hackers",
  });
  return new Response(png, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
};
