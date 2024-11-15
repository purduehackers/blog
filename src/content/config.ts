import { defineCollection, z } from "astro:content";

const blog = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    authors: z.array(z.string()),
    color: z
      .object({
        main: z.string(),
        mainLight: z.string(),
        bg: z.string(),
        bgLight: z.string(),
      })
      .optional(),
    type: z.enum(["blog", "vip-newsletter"]).default("blog"),
  }),
});

export const collections = { blog };
