import { defineCollection, z } from "astro:content";

const blog = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    authors: z.array(z.string()),
    type: z.enum(["blog", "vip-newsletter"]).default("blog"),
    externalUrl: z.string().url().optional(),
  }),
});

export const collections = { blog };
