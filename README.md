# Purdue Hackers Blog

The source for [blog.purduehackers.com](https://blog.purduehackers.com): stories,
projects, and newsletters from the Purdue Hackers community. Built with Astro,
TypeScript, MDX, and Tailwind CSS.

## Getting started

Requires Node.js 22 and pnpm 9.

```sh
git clone https://github.com/purduehackers/blog.git
cd blog
pnpm install
cp .env.example .env
```

Set these values in `.env` to use a local SQLite database:

```dotenv
BLOG_STORAGE_TURSO_DATABASE_URL=file:./newsletter.local.db
NEWSLETTER_SITE_URL=http://localhost:3000
```

Initialize the database and start the development server:

```sh
pnpm newsletter:setup
pnpm dev
```

Open [localhost:3000](http://localhost:3000). Blog development works without
external credentials. Newsletter signup and administration require additional
services; see the [newsletter guide](docs/newsletter.md) to configure them.

## Commands

| Command                 | Description                                      |
| ----------------------- | ------------------------------------------------ |
| `pnpm dev`              | Start the development server                     |
| `pnpm build`            | Run Astro checks and create the production build |
| `pnpm test`             | Run the test suite                               |
| `pnpm newsletter:setup` | Initialize or update the newsletter database     |

Tests use mocked external services and disposable local databases. They do not
send email or modify the live mailing list.

## Writing posts

Add Markdown or MDX files to `src/content/blog`. Posts can contain article
content or link to an article on another website.

See [Writing posts](docs/content.md) for frontmatter, author photos, cover images,
and external links. Store local images in `public/posts/<post-name>/`.

## Project structure

```text
src/
  components/    Shared UI components
  content/blog/  Markdown and MDX posts
  layouts/       Page layouts
  lib/           Content, image, and newsletter utilities
  pages/         Pages and API routes
  styles/        Global and article styles
public/          Static assets
scripts/         Database and mail tools
tests/           Automated tests
```

## Deployment

The site deploys to Vercel using Node.js 22. Configure environment variables from
[.env.example](.env.example) and follow the [newsletter guide](docs/newsletter.md)
for production storage and integrations.

## Contributing

Issues and pull requests are welcome. Keep changes focused and run `pnpm test`
and `pnpm build` before submitting a pull request. UI changes should follow the
[Purdue Hackers components](https://components.purduehackers.com/) design system.

## Credits

The design uses Purdue Hackers components, navigation from the
[events site](https://events.purduehackers.com/), and generated avatars from
[Purdue Hackers ID](https://github.com/purduehackers/id). Pixel icons are from
[HackerNoon's Pixel Icon Library](https://github.com/hackernoon/pixel-icon-library)
(CC BY 4.0).
