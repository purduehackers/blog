# Standalone Microsoft Mail Tool

A portable command-line tool for Microsoft 365 and Outlook mail. Connect multiple
accounts, list/search messages, read messages, send plain-text emails, and forward
original messages. Connections are saved locally and refreshed automatically.

Requires Node.js 22.13 or newer (Node.js 24 is also supported). No npm packages,
database, web server, or access to the Purdue Hackers blog is needed.
This tool uses the **Purdue Hackers Emailer** Microsoft app registration and the
Purdue directory. Recipients sign in to their own permitted Purdue mailboxes.
It does not give them access to anyone else's mailbox. Other organizations and
personal Outlook accounts are not configured by this bundle.

## Bundled application

- Application (client) ID: `4f57124f-5363-4ecb-9332-15f5b9f36609`
- Directory (tenant) ID: `4130bd39-7c53-419c-b1e5-8758d6d63f21`

These are public identifiers, not passwords or mailbox credentials. Public client
flows are already configured on this registration. No new app registration,
client secret, redirect URI, or .env file is needed.

Sign-in requests delegated `User.Read`, `Mail.ReadWrite`, `Mail.Send`, and
`Calendars.ReadWrite`, matching this app's permissions, plus `offline_access`
for reusable connections. This tool implements reading, sending, and forwarding;
it does not implement calendar or mail modification commands. Purdue access and
consent policies still apply to each user. If Microsoft requests administrator
approval, ask Purdue IT to review access to **Purdue Hackers Emailer**; the tool
cannot bypass that policy.

## Connect an account once

Extract the ZIP, open Terminal in the `microsoft-mail-tool` folder, then run:

```sh
npm run mail -- auth --account YOUR_EMAIL@purdue.edu
```

No installation or build step is needed. Run `npm run mail -- --help` for options.
The optional `.env.example` contains the same bundled IDs and can be copied to
`.env` if you deliberately want to override the application configuration.

Open Microsoft's displayed sign-in URL, enter the displayed code, and sign in as
that same mailbox. Repeat with a different `--account` for each additional account.
Use the primary mailbox address, not an alias. An unconnected account produces an
error with the exact auth command to run. Shared-mailbox delegation and arbitrary
From addresses are not implemented.

Credentials are encrypted with AES-256-GCM in `.mail-accounts/`. A random encryption
key is generated automatically as `.mail-accounts/private.key`, with owner-only
file permissions on systems that support them. Keep the entire directory private;
the key and credentials together grant access. Tokens are never printed. Do not
include `.env` or `.mail-accounts/` when sharing this tool after using it.
Deleting or changing the key requires reconnecting accounts. Refresh tokens
renew access automatically, but revocation, expiry, or organization policies may
require signing in again. Nothing runs in the background.

## Commands

```sh
# Latest three inbox messages with IDs and previews
npm run mail -- list --account YOUR_EMAIL@purdue.edu --limit 3

# Search inbox (or use --folder sentitems)
npm run mail -- list --account YOUR_EMAIL@purdue.edu --search 'from:someone@example.com'

# Read a full message without marking it as read
npm run mail -- read --account YOUR_EMAIL@purdue.edu --id 'MESSAGE_ID'

# Send one email immediately
npm run mail -- send --account YOUR_EMAIL@purdue.edu --to friend@example.com --subject 'Hello' --body 'Hello from my mail tool!'

# Use a UTF-8 file for a longer body
npm run mail -- send --account YOUR_EMAIL@purdue.edu --to friend@example.com --subject 'Hello' --body-file /absolute/path/message.txt

# Forward an original email immediately
npm run mail -- forward --account YOUR_EMAIL@purdue.edu --id 'MESSAGE_ID' --to friend@example.com

# Remove locally saved account credentials
npm run mail -- disconnect --account YOUR_EMAIL@purdue.edu
```

List and read return JSON. `--limit` accepts 1–100; use `--skip 10` with
`--limit 10` for the next page. Microsoft search limits results to 1,000; narrow
your search if needed. Send and forward return acceptance, not delivery
confirmation. They never retry automatically. If a send or forward times out,
check Sent Items before trying again to avoid duplicates. No attachment upload
or CC/BCC options are implemented; native forwards preserve the original message.

Disconnect removes the local connection; revoke app access through your Microsoft
account or organization's admin if you also want to remove Microsoft consent.
Commands for one account use a lock. If a process is forcibly killed, confirm it
has stopped before removing the corresponding `.mail-accounts/*.lock` file.

## Give the tool to an AI assistant

Point the assistant to `ASSISTANT.md` and name the account and task, for example:
"Use this mail tool to summarize the latest three emails for YOUR_EMAIL@purdue.edu."
The assistant must run on the computer with your saved connection, or you must
run its commands yourself. Sending this source archive does not share a mailbox.

## Verify the tool

```sh
npm test
```

Tests use mocked Microsoft responses and temporary encrypted files. They send no
real email and do not require an account. Real sign-in is required to verify your
organization's access policy.
