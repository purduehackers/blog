# Newsletter maintainer guide

Organizers use `/admin` to import Notion pages, publish them on the blog, and send them through the Purdue Hackers mailbox. Notion holds the mailing list. Turso holds imported editions, media, and delivery history.

## Configure a deployment

Start with [`.env.example`](../.env.example) for the environment variable names. Use Node.js 22. Keep credentials server-side and use a separate database and test mailing list for development.

1. **Notion.** Give the integration read, insert, and update permissions. Connect it to the original mailing-list database and to each edition page you want to import. Set `NOTION_API_KEY` and check that `NOTION_DATABASE_ID` points to your mailing list. The list needs `Name` and `Email` fields, an `Unsubscribed` checkbox, and an `Unsubscribed At` date. If the name or email fields differ, set `NOTION_NAME_PROPERTY` or `NOTION_EMAIL_PROPERTY`. If the database has multiple data sources, set `NOTION_DATA_SOURCE_ID` to the mailing list's source ID.
2. **Turso.** Set `BLOG_STORAGE_TURSO_DATABASE_URL` and `BLOG_STORAGE_TURSO_AUTH_TOKEN`. For local storage, use `file:./newsletter.local.db` as the URL and leave the token unset. Run `pnpm newsletter:setup` against the intended database before opening the admin or connecting the mailbox. Rerun it when a deployment needs new tables.
3. **Site URL and encryption.** Set `NEWSLETTER_SITE_URL` to the deployment origin, or to `http://localhost:3000` locally. Generate `NEWSLETTER_ENCRYPTION_KEY` with `openssl rand -base64 32`. Back up the key separately from the database and keep it stable so stored credentials and tracked links continue working.
4. **Purdue Hackers ID.** Create a confidential authorization-code app with PKCE, `client_secret_basic`, and the `openid`, `profile`, and `roles` scopes. Register the exact callback URL (the site origin plus `/admin/callback`). Set `PH_ID_CLIENT_ID` and `PH_ID_CLIENT_SECRET`. The default required role is `organizer`.
5. **Microsoft.** Create a Microsoft Entra app with public client flows and delegated Graph permissions `Mail.Send`, `User.Read`, and `Calendars.ReadWrite`. Set `MICROSOFT_CLIENT_ID`, `MICROSOFT_TENANT_ID`, and `MICROSOFT_SENDER_EMAIL` (defaults to `phackers@purdue.edu`). Run `pnpm newsletter:connect` locally with the target deployment's database and encryption key, then sign in as the configured sender's primary mailbox.

The CLI scripts load `.env` and use `.env.local` for overrides. On Vercel, set the variables for each deployment environment and redeploy after changing them. The build script sets the Vercel functions to Node.js 22 with a 60-second timeout for compatibility with the Astro adapter.

## Publish and send an edition

1. Open **Import newsletter** in `/admin` and paste the Notion page URL. You can enter a name or use the Notion page title.
2. Review the preview and use **Send test** to check the edition in your inbox.
3. Choose **Publish edition** to make the edition available at `/posts/<edition-id>`.
4. Type `SEND` and choose **Send newsletter**. The first send fixes the audience for that edition. The sender checks each address for an active subscription before sending.
5. Keep the tab open during delivery. Use **Pause after current email** to stop and **Resume delivery** to pick up where you left off. If your sign-in expires, sign in again before resuming.

Use **Save name** to rename an edition and **Reimport from Notion** to refresh its content at the same URL. Changes to a published edition can take up to a minute to appear on the blog.

If a delivery result is uncertain, check the sender's **Sent Items** before choosing **Skip recipient** or **Retry after review**. Microsoft Graph's `202 Accepted` means Microsoft queued the message for processing.

## Imported media and link statistics

The blog copies Notion-hosted images and videos so they stay available after Notion's temporary URLs expire. Large videos can use a permanent public link. If an import flags an unsupported block, convert it to text, an image, or a public link and try again.

Open a published edition in `/admin` to see clicks from the blog and email. Unique counts are based on browsers and can be affected by email link scanners and cleared cookies.

## Mailing list and test tools

The footer signup form adds subscribers to Notion. Newsletter emails include a personalized unsubscribe link. Readers can also visit `/unsubscribe` and confirm their email address there.

Run `pnpm test` for automated checks. The tests use mock services and disposable local databases. To send a single plain-text message from the connected mailbox, run `pnpm newsletter:test-email --help` for options. The [personal mail tool](../MAIL_TOOL.md) has its own setup.
