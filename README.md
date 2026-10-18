# blog

where we share our magic with the world ✨💛⚡️, now with more Astro!

## Newsletter signup

The form in the shared footer submits names and email addresses to the Notion
mailing list through `/api/subscribe`. Blog pages stay prerendered; only this
endpoint runs as a Vercel serverless function. Signing up adds a Notion entry;
sending newsletters still happens through your existing mailing workflow.

Use Node.js 22. The build's final step updates the generated Vercel function
metadata to `nodejs22.x` with a 60-second timeout. This is needed because the
Astro 4-compatible Vercel adapter otherwise falls back to retired Node.js 18
when built on Node.js 22. Remove that compatibility step when upgrading Astro
and the Vercel adapter together.

### Connect the existing integration

1. In Notion, open the original mailing list database and add your integration
   under **Connections**. The integration needs **Read content** (schema and
   duplicate lookup) and **Insert content** (new subscribers).
2. In the Vercel project's **Settings → Environment Variables**, set
   `NOTION_API_KEY` to the integration's internal token. Keep this secret and
   never use a `PUBLIC_` prefix.
3. The database from the supplied link is already the default:
   `346181f3b6ed800586cfdd7c42d0ac65`. Optionally set `NOTION_DATABASE_ID` to
   override it. The `v=` value in the Notion URL is a view ID, not the database ID.
4. The default columns are `Name` (title or rich text) and `Email` (email or rich
   text). If yours differ, set `NOTION_NAME_PROPERTY` and
   `NOTION_EMAIL_PROPERTY` to their exact names. If the database has multiple
   data sources, also set `NOTION_DATA_SOURCE_ID` to the mailing list's source ID
   from Notion's **Manage data sources** menu. A single source is discovered
   automatically. For a linked database view, use the original database ID.
5. Enable the variables for the desired Vercel environments and redeploy.
   Submit your own name and email, then verify the row appears in Notion.
   Submitting that email again should succeed without adding another row.

For local development, copy `.env.example` to `.env`, fill in the token, install
dependencies with `pnpm install`, and run `pnpm dev`. Do not commit `.env`.

The server validates inputs, rejects cross-origin submissions, ignores a hidden
bot-trap field, and checks existing emails before creating a row. Existing rows
are never edited. Simultaneous submissions can still race because Notion does
not enforce uniqueness. For a public launch, Vercel Firewall rate limits on
`/api/subscribe` can provide additional protection against automated signups.

Run `pnpm build` for Astro checks and the production build. The isolated signup
tests run with `node --experimental-strip-types --test tests/newsletter.test.ts`.

## Unsubscribe links

Use `https://blog.purduehackers.com/unsubscribe?email=ENCODED_EMAIL` in your
newsletter, replacing `ENCODED_EMAIL` with the recipient address encoded using
`encodeURIComponent(email)` (especially for addresses containing `+`). Locally,
use `http://localhost:3000/unsubscribe?email=you%40example.com`.

The page prefills the email and asks for confirmation. Visiting the link alone
does not change the subscription, so email link scanners cannot unsubscribe
readers. `/unsubscribe` without an email also lets readers enter their address.
Confirmation calls `/api/unsubscribe` and updates matching active rows in the
existing mailing list: `Unsubscribed` becomes checked and `Unsubscribed At` is
set to the current time. Contacts are kept in Notion, and repeated requests
preserve the original timestamp. Unknown addresses receive the same confirmation.

The existing Notion integration also needs **Update content** capability. The
database needs `Unsubscribed` (checkbox) and `Unsubscribed At` (date), which are
already present in this mailing list. Your newsletter sending workflow must
exclude rows where `Unsubscribed` is checked.

Run all subscription tests with
`node --experimental-strip-types --test tests/*.test.ts`. These use mocked
Notion requests and never modify real mailing list entries.
