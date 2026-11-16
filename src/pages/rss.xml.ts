import rss from "@astrojs/rss";
import type { APIRoute } from "astro";
import { loadBlogPosts } from "../lib/blog-posts";
export const prerender = false;
import { SITE_TITLE, SITE_DESCRIPTION } from "../consts";

export const GET: APIRoute = async ({ site }) => {
  const { posts: sorted_posts, unavailable } = await loadBlogPosts(true);
  if (unavailable)
    return new Response("Recent posts are temporarily unavailable.", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  const site_url = new URL("/", site!).href;

  const response = await rss({
    xmlns: {
      dc: `http://purl.org/dc/elements/1.1/`,
      content: `http://purl.org/rss/1.0/modules/content/`,
      atom: `http://www.w3.org/2005/Atom`,
    },
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site: site!,
    customData:
      `<lastBuildDate>${sorted_posts[0]!.data.pubDate.toUTCString()}</lastBuildDate>` +
      `<atom:link href="${site_url}rss.xml" rel="self" type="application/rss+xml"/>` +
      `<pubDate>${sorted_posts[0]!.data.pubDate.toUTCString()}</pubDate>`,
    items: sorted_posts.map((post) => ({
      ...post.data,
      link:
        post.data.externalUrl ??
        `/${post.data.type === "vip-newsletter" ? "vip-newsletter" : "posts"}/${post.slug}/`,
    })),
  });
  response.headers.set("Cache-Control", "public, max-age=60, s-maxage=60");
  return response;
};
