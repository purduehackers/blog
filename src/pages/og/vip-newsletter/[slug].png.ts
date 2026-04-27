import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

import { renderPostOg } from "lib/og";

export async function getStaticPaths() {
  const posts = await getCollection(
    "blog",
    ({ data }) => data.type === "vip-newsletter",
  );
  return posts.map((post) => ({
    params: { slug: post.slug },
    props: {
      title: post.data.title,
      pubDate: post.data.pubDate,
      authors: post.data.authors,
    },
  }));
}

export const GET: APIRoute = async ({ props }) => {
  const { title, pubDate, authors } = props as {
    title: string;
    pubDate: Date;
    authors: string[];
  };
  const png = await renderPostOg({ title, pubDate, authors });
  return new Response(png, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
};
