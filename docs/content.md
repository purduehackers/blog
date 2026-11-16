# Writing posts

Posts live in `src/content/blog` as Markdown (`.md`) or MDX (`.mdx`) files. The
filename determines the URL: `hello.mdx` becomes `/posts/hello`.

## Frontmatter

Every post needs a title, description, publication date, and list of authors:

```md
---
title: Hello, world
description: An introduction to our latest project.
pubDate: 2026-11-15
authors: ["[Your Name]()"]
---

Write your post here.
```

Optional fields:

| Field           | Description                                   |
| --------------- | --------------------------------------------- |
| `updatedDate`   | Date the article was last updated             |
| `type`          | `blog` (default) or `vip-newsletter`          |
| `externalUrl`   | Original URL for a post hosted elsewhere      |
| `coverImage`    | Explicit cover image URL or public asset path |
| `coverImageAlt` | Description of the cover image                |

VIP newsletters appear under `/vip-newsletter`. Other posts appear on the
homepage in publication order, with the newest post featured. Content-file
changes require a new deployment.

## Authors

Use Markdown link syntax for each author's name and photo:

```yaml
authors:
  - "[Jack Hogan](https://github.com/ImTheSquid.png)"
  - "[Your Name]()"
```

An empty URL selects a generated avatar based on the author's name, using the
[Purdue Hackers ID algorithm](https://github.com/purduehackers/id/blob/2500796bb4d77b2de49c2a6bbb2e3d8c20d1e682/src/lib/components/pixel.ts).
Use this instead of a generic placeholder photo. Broken or tiny images also
fall back to a generated avatar. No ID account is needed.

## Images

Place local images in `public/posts/<post-name>/` and reference them from the
site root, such as `/posts/hello/project.jpg`.

Cards and article headers use text by default. To add a cover, set both
`coverImage` and `coverImageAlt`; covers receive a grayscale treatment blended
with the brand accent. Images from the article body are never automatically
selected as covers.

## External posts

To link to an article hosted elsewhere, add a post with `externalUrl` and no
body. Use the original title, author, description, and publication date:

```yaml
---
title: From Tiny Seed to Towering Sequoia
description: How Purdue Hackers changed my life.
pubDate: 2026-05-05
authors: ["[Jack Hogan](https://github.com/ImTheSquid.png)"]
externalUrl: https://www.jackhogan.me/blog/from-tiny-seed-to-towering-sequoia
---
```

The card shows an “External post” tag beside the author and opens the original
article in a new tab. RSS links to the original article too. The local post URL
provides a shareable preview, a canonical link, and a redirect after three seconds.
