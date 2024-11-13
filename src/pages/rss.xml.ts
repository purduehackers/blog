import rss from "@astrojs/rss";
import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { SITE_TITLE, SITE_DESCRIPTION } from "../consts";

export const GET: APIRoute = async ({ site }) => {
  const posts = await getCollection("blog", ({ data }) => data.type === "blog");

  const sorted_posts = posts.sort(
    (a, b) => Number(b.data.pubDate) - Number(a.data.pubDate),
  );

  const site_url =
    process.env.PUBLIC_VERCEL_ENV === "production"
      ? "https://blog.purduehackers.com/"
      : "http://localhost:3000/";

  return rss({
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
      link: `/posts/${post.slug}/`,
    })),
  });
};
