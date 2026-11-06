# blog

where we share our magic with the world ✨💛⚡️, now with more Astro!

## Newsletter signup

The form in the shared footer submits names and email addresses to the Notion
mailing list through `/api/subscribe`. The blog homepage, posts, RSS feed,
subscription endpoints, and admin run as Vercel serverless routes. Existing VIP
newsletter pages stay prerendered. Signing up adds a Notion entry;
the newsletter admin below handles importing, publishing, and sending editions.

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


## Newsletter administration

Existing posts are **static MDX** in `src/content/blog`. The `/admin` imports
Notion pages into Turso and publishes them as blog posts under `/posts/{edition-id}`.
The homepage combines published imports and regular MDX blog posts in date order.
VIP newsletters retain their separate `/vip-newsletter` section; RSS includes both. Publishing takes effect without a rebuild; public
pages cache results for up to 60 seconds. Imported posts use the existing blog
layout. The `/newsletter` addresses added for imports redirect to the blog.

The sender defaults to **phackers@purdue.edu**. Admin access requires Purdue
Hackers ID's **organizer** role, which ID also grants to admins. The role is
verified through ID's user-info endpoint on every privileged request, including
each send continuation. Missing roles, expired sessions, and provider failures
never authorize an admin action. Sign-in uses authorization code + PKCE S256,
a single-use state bound to an HTTP-only cookie, and server-side sessions. Tokens
are encrypted with AES-256-GCM; no token is returned to the browser.

### 1. Configure storage and the ID application

1. In the Vercel project's **Storage / Marketplace**, install and connect
   [Turso](https://vercel.com/marketplace/tursocloud/database). The native
   integration is configured with the `BLOG_STORAGE_` prefix, supplying
   `BLOG_STORAGE_TURSO_DATABASE_URL` and `BLOG_STORAGE_TURSO_AUTH_TOKEN`.
   These names take precedence; unprefixed `TURSO_DATABASE_URL` and
   `TURSO_AUTH_TOKEN` are also supported as a pair. The server
   uses the official `@libsql/client` SDK over HTTPS, with no local replica in
   Vercel's temporary filesystem. Use a **separate database** for development
   and previews so test deliveries never touch production history.
2. Pull the project's development variables with `vercel env pull .env.local`
   (or copy the two Turso values to your ignored local `.env`). Both newsletter
   scripts load `.env`, then `.env.local` as overrides. Run
   `npm run newsletter:setup` once against the intended database **before**
   connecting Microsoft or opening the admin. This idempotent setup creates
   the `newsletter_*` tables in one transaction and preserves existing rows.
   It is an explicit setup step, not part of the build or public page requests.
   For production setup, use that environment's credentials deliberately.
3. Generate `NEWSLETTER_ENCRYPTION_KEY` with `openssl rand -base64 32`. Store it
   in Vercel and in your local `.env` used by the capture script. Keep the key
   stable and backed up separately; changing it invalidates stored credentials
   and sessions. It must never use a `PUBLIC_` prefix.
4. Set `NEWSLETTER_SITE_URL=https://blog.purduehackers.com`. For local testing,
   use `http://localhost:3000` and a separate development database. Absolute
   email/image/unsubscribe links use this configured origin rather than request
   headers. If the public domain changes, reimport future editions with the new
   origin; existing emails continue referencing their original domain.
5. In [Purdue Hackers ID](https://id.purduehackers.com), create a confidential
   OAuth application with authorization-code grant, PKCE, **client_secret_basic**
   token authentication, and the `openid`, `profile`, and `roles` scopes. Register
   `https://blog.purduehackers.com/admin/callback` as an exact redirect URI.
   Register `http://localhost:3000/admin/callback` for local development.
   The ID app-creation UI uses `client_secret_basic`, which is the blog default.
   Only set `PH_ID_TOKEN_AUTH_METHOD=client_secret_post` if an application was
   explicitly registered with that different authentication method. Token
   exchange uses server HTTPS without browser Fetch Metadata or cookies, as
   required by ID's server OAuth endpoint protection.
6. Set `PH_ID_CLIENT_ID`, `PH_ID_CLIENT_SECRET`, and
   `PH_ID_REQUIRED_ROLE=organizer`. ID currently defines `alumni`, `organizer`,
   and `admin`; an admin has both `organizer` and `admin` grants.
7. Add the variables to Vercel and redeploy. Protected pages and APIs use
   `private, no-store`; they are excluded from search indexing. The ID session
   lasts at most one hour; sign in again to continue a longer delivery.

Turso stores editions, frozen audiences, recipient delivery results, credentials,
images, OAuth states, sessions, and short-lived leases in separate SQLite tables.
Image copies remain bounded to 2 MB each and 8 MB per edition. They use BLOB
columns rather than base64 text in the database. Session and OAuth expiry is
checked by SQL; subsequent sign-ins remove expired rows. A write transaction
atomically consumes each OAuth state. Audience creation commits all recipients
or none, and a unique `(edition_id, email)` key plus conditional updates makes
recipient claims atomic across serverless instances. Reads used by the admin
run in short write-mode transactions to observe primary database state. No
transaction is held open while contacting Notion or Microsoft.

For fully local development, set `BLOG_STORAGE_TURSO_DATABASE_URL=file:./newsletter.local.db`
in `.env.local`, then run `npm run newsletter:setup`. No Turso token is required
for a local file. Local database/journal files are ignored by Git. File URLs are
rejected when running on Vercel. Keep backups of the remote database and the
separate encryption key; this database holds the published archive and delivery
history.

### 2. Connect the Purdue mailbox once

This follows BuildPurdue's delegated Microsoft Graph/device-code pattern, using
separate Purdue Hackers credentials and storage. It sends through
`/me/sendMail` as the connected mailbox, without SMTP passwords.

1. Create a Microsoft Entra application in the appropriate Purdue tenant. Set
   **Allow public client flows** to **Yes**. Add Microsoft Graph **delegated**
   permissions `Mail.Send`, `User.Read`, and `Calendars.ReadWrite`. The calendar
   permission prepares this same mailbox connection for future event features.
   `offline_access` is requested during
   login to receive a refresh token. Purdue's tenant policy may require IT
   approval; follow the consent response from Microsoft.
2. Set `MICROSOFT_CLIENT_ID`, `MICROSOFT_TENANT_ID`, and
   `MICROSOFT_SENDER_EMAIL=phackers@purdue.edu` in Vercel and local `.env`.
   The app must be a public client; this flow does not use a client secret.
3. With Node.js 22, run `npm run newsletter:connect` (or
   `pnpm newsletter:connect`). Follow Microsoft's displayed login instructions
   and sign in **as phackers@purdue.edu**. The script verifies the account using
   Graph `/me` and refuses a different mailbox. It stores the encrypted refresh
   token in Turso without printing or saving tokens to a local file. It sends
   no email. Local `.env` must target the same database/encryption key as
   the deployment you are connecting.
4. The server persists rotated refresh tokens before sending. Rerun the script
   if Microsoft revokes consent, requires interaction, or the grant expires.
   If the mailbox was connected before calendar access was added, add the
   delegated `Calendars.ReadWrite` permission to the Entra app and rerun
   `npm run newsletter:connect` to grant it. Changing the code alone does not
   expand an existing Microsoft grant.

The capture script requests mail, profile verification, and calendar consent
in one login, matching BuildPurdue's setup. Newsletter token refreshes still
request only `Mail.Send`, `User.Read`, and `offline_access`, so an older grant
without calendar consent can keep sending mail. The captured broad access token
is not reused for newsletter sends; the first send redeems a narrower mail
access token. Future calendar code can redeem the same rotating refresh token
for `Calendars.ReadWrite` with a separate access-token cache. No calendar event
creation or updates are implemented or performed by this setup.

This implementation expects phackers@purdue.edu to be the signed-in user's
primary mailbox. If it is a **shared mailbox** accessed through another user's
account, it needs a different setup (`Mail.Send.Shared`, mailbox Send As rights,
and `/users/{mailbox}/sendMail`) before sending; the script intentionally refuses
a different primary mailbox.

Microsoft Graph's [sendMail API](https://learn.microsoft.com/en-us/graph/api/user-sendmail?view=graph-rest-1.0)
returns **202 Accepted**, which means queued for processing, not confirmed inbox
delivery. Purdue/Exchange sending limits and tenant anti-spam policies still
apply; this is suitable for the club's mailing workflow, not an unlimited bulk
mailer.

### Send a basic test email without the admin page

For reusable personal mail connections, including reading and searching mail,
see [MAIL_TOOL.md](MAIL_TOOL.md). Run `npm run mail -- --help` for commands.

Use the saved mailbox connection to send one plain-text email:

```sh
npm run newsletter:test-email -- --from phackers@purdue.edu --to you@purdue.edu --subject "Test email" --body "Hello from Purdue Hackers!"
```

To test another Purdue mailbox, add `--login` and set `--from` to that mailbox.
Follow the displayed Microsoft sign-in instructions. This separate login keeps
credentials in memory and does not replace the saved newsletter connection.
Purdue policies and application access restrictions still apply. The sender must
match the signed-in mailbox; this script does not support shared mailboxes or
arbitrary From addresses. It sends immediately to exactly one recipient, saves
a copy in Sent Items, and does not access subscribers or publish an edition.
HTTP 202 means accepted for processing, not confirmed delivery. Check Sent Items
before retrying an uncertain result. Run with `--help` to view all options.

### 3. Import, review, publish, and send

1. Give the Notion integration **Read content** access and connect the edition
   page through its **Connections** menu. It must also retain its existing
   mailing-list permissions. The supplied page link is accepted directly:
   `https://app.notion.com/p/purduehackers/edition-1-3e3181f3b6ed80c6b392cdfb4bf9a3ef`.
2. Visit `/admin`, sign in with an organizer/admin ID, paste the page URL, and
   choose **Import edition**. This creates an immutable draft snapshot, not a
   public page or a send. Changes in Notion require a fresh import. A new
   import is a distinct edition with its own delivery history.
3. Preview the edition and **Send test** to your own address. Test emails are
   labeled `[TEST]` and do not modify the subscriber delivery record.
4. **Publish edition** makes the saved copy available on the website. Review
   it through **View published edition**. Publication is idempotent.
5. Type `SEND` and choose **Send newsletter**. The audience is read from the
   existing Notion mailing list, deduplicated, and frozen for that edition.
   Only rows with `Unsubscribed=false` are eligible. A duplicate unsubscribed
   row suppresses that address. Each subscription is rechecked immediately
   before sending; removed/unsubscribed contacts are skipped. A subscription
   change after that check may still race the email request.
6. Keep the tab open. Delivery runs one recipient per server request and saves
   each result. **Pause** stops after the current request. After a closed tab,
   expired sign-in, or interruption, reopen the edition and **Resume delivery**.
   Newly subscribed readers are not added to an already-started audience.

Recipients never see the list: each email has exactly one To address and its own
encoded unsubscribe link. Subscription GET links still require confirmation,
so mail scanners do not unsubscribe readers just by opening a link.

A durable per-recipient claim is saved **before** calling Microsoft. Accepted
and skipped recipients are never resent automatically. If Microsoft times out,
a server crashes after submitting mail, or saving the result fails, delivery
stops rather than guessing. Review the sender's **Sent Items** for that recipient,
then **Skip recipient** if it was sent or **Retry after review** if it was not.
Rejected requests (including rate limits) also pause until reviewed. Avoid
repeated test clicks after an ambiguous test-send timeout; tests have no durable
recipient history. A failed request can leave a lease for up to two minutes;
wait and refresh if another operation appears to be running.

### Supported Notion content and limits

Imports preserve rich text, safe links, headings, nested lists, quotes,
callouts, code, dividers, images, checklists, tables, columns, toggles, and
readable synced-block children. Text columns/toggles become a single-column
layout. Adjacent images form responsive two-column galleries (three across for
groups of exactly three), including across empty paragraphs and Notion columns.
Captions stay with each image; standalone images use the blog's image sizing.
The same gallery grouping applies to existing snapshots, admin previews, and
email HTML. Email galleries use presentation tables with a mobile stacking rule;
website images use the existing click-to-enlarge lightbox.
Notion-hosted videos (MP4, WebM, MOV, Ogg) are copied to permanent site URLs
and become “Watch video” links with their captions. Videos are limited to 20 MB
each and 40 MB per edition; use a permanent public link for larger videos.
External videos, embeds, bookmarks, and external files become links. Unsupported
blocks and expiring file attachments fail the import with an actionable message
instead of silently dropping content. Convert them to text, an image, or a
permanent public link first.

Equation blocks and inline equations preserve their source as escaped text
(including decorative symbols); LaTeX is not typeset in emails.

Notion-hosted PNG/JPEG/GIF/WebP images are stored as SQLite BLOBs in Turso and served from
permanent site URLs, so signed Notion URLs do not expire in old emails. External
HTTPS images remain external; their availability depends on the original host.
Still images over 200 KB are automatically resized to fit within 1280 × 2400 pixels
and optimized as JPEG (PNG when transparent). Original images must be under 20 MB and 40 megapixels when
resizing; animated GIFs must be under 2 MB to preserve their animation.
Unpublished test images have unguessable public URLs so email clients can load
them; avoid importing sensitive images. Limits: 500 blocks, 10 nesting levels,
60 Notion reads, 180 KB rendered HTML, 2 MB per copied image, 8 MB total images,
and 10,000 mailing-list rows. Failed imports may leave unreferenced media rows;
there is no automated media cleanup. The admin/archive show the newest 100
editions; older direct edition URLs continue working. This version has no draft
editing, deletion, scheduler, or background delivery worker.

### Verify without sending real mail

Run `npm test` for signup, unsubscribe, OAuth/roles, token encryption and
rotation, Notion import, publication, subscription suppression, and delivery
interruption tests. Storage tests use disposable local SQLite databases through
the same libSQL SDK, including real transactions and constraints. External
Notion and Microsoft requests remain mocked; no live emails are sent. Run
`npm run build` for Astro checks and the Vercel production build. The final
runtime compatibility step still sets Node.js 22 and a 60-second function limit.
A real organizer sign-in and a deliberate test email remain deployment checks
once the app registrations and storage are configured.

### Newsletter link statistics

Edition content links are automatically signed and rewritten for the website and newly sent emails. In the admin page, load an edition to see per-link and edition-wide unique browsers and total clicks for web, email, and both combined. Reload the edition to refresh statistics. Combined unique counts deduplicate the same browser across sources and links; cookies blocked or cleared, different devices, and email security scanners can affect these estimates. No recipient email or IP address is stored in click records. Draft/test editions do not record clicks until published. Previously sent emails cannot be retroactively tracked.

Run `npm run newsletter:setup` against each deployment's database before deploying this feature to add the click tables without changing existing data. Keep `NEWSLETTER_ENCRYPTION_KEY` stable so existing tracked links remain valid.
