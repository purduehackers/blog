# Purdue Hackers Blog

Where we share our magic with the world ✨💛⚡️

Read about our projects, Hack Nights, and what we're up to at [blog.purduehackers.com](https://blog.purduehackers.com), or subscribe via [RSS](https://blog.purduehackers.com/rss.xml).

## Run locally

With Node.js 22 and pnpm installed, run from the repository root:

```sh
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). You can preview MDX posts and work on the site without newsletter credentials. Published newsletter imports require a database connection.

Run `pnpm test` for the test suite and `pnpm build` for Astro checks and the production build.

## Edit the blog

- [`src/content/blog/`](src/content/blog/) contains the posts as MDX. Use [hello.mdx](src/content/blog/hello.mdx) as a starting point for frontmatter.
- [`public/posts/`](public/posts/) contains post images. Put new images in a folder named after the post slug.
- [`src/pages/`](src/pages/) and [`src/components/`](src/components/) contain the Astro routes and shared UI.

Newsletter editions are imported from Notion through `/admin`. See the [newsletter maintainer guide](docs/newsletter.md) for setup, publishing, and sending.
