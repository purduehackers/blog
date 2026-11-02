import { getCollection, type CollectionEntry } from "astro:content";
import { listEditions } from "./admin/campaigns";

export interface BlogPostSummary {
  slug: string;
  data: CollectionEntry<"blog">["data"];
}

export async function loadBlogPosts(includeVip = false) {
  const posts: BlogPostSummary[] = await getCollection(
    "blog",
    ({ data }) => includeVip || data.type === "blog",
  );
  let unavailable = false;
  try {
    const published = await listEditions(true);
    posts.push(
      ...published.map((page) => ({
        slug: page.id,
        data: {
          title: page.title,
          description:
            "News, projects, and what’s coming up at Purdue Hackers.",
          pubDate: new Date(page.publishedAt!),
          authors: [],
          type: "blog" as const,
        },
      })),
    );
  } catch {
    // Keep the existing MDX posts readable during a database outage.
    unavailable = true;
  }
  posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
  return { posts, unavailable };
}
