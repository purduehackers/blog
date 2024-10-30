import { defineCollection, z } from "astro:content";

const blog = defineCollection({
  type: "content",
  // Type-check frontmatter using a schema
  schema: z.object({
    title: z.string(),
    description: z.string(),
    // Transform string to Date object
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
  }),
});

export const collections = { blog };
