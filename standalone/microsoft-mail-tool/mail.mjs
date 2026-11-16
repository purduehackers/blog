import { parseArgs } from "node:util";
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { required } from "./lib/config.mjs";
import { MailClient, email } from "./lib/mail-client.mjs";

const help = `Saved Microsoft mail connections (one account per --account):
  npm run mail -- auth --account you@example.com
  npm run mail -- list --account you@example.com --limit 10
  npm run mail -- list --account you@example.com --search 'from:someone@example.com'
  npm run mail -- read --account you@example.com --id 'MESSAGE_ID'
  npm run mail -- forward --account you@example.com --id 'MESSAGE_ID' --to recipient@example.com
  npm run mail -- send --account you@example.com --to recipient@example.com --subject 'Hello' --body 'Message'
  npm run mail -- disconnect --account you@example.com

list options: --folder inbox|sentitems|... (default inbox), --limit 1-100,
              --skip 0 (pagination), --search 'Graph mail search query'
send options: --body 'Text' OR --body-file /path/to/message.txt
Send acts immediately. Reads return JSON and do not mark messages as read.
Credentials are encrypted in .mail-accounts/ using an automatically generated local key.
Keep .mail-accounts/private.key private; reconnect if Microsoft revokes access.
`;

export async function main(args = process.argv.slice(2)) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      account: { type: "string" },
      to: { type: "string" },
      subject: { type: "string" },
      body: { type: "string" },
      "body-file": { type: "string" },
      id: { type: "string" },
      folder: { type: "string", default: "inbox" },
      limit: { type: "string", default: "10" },
      skip: { type: "string", default: "0" },
      search: { type: "string" },
      help: { type: "boolean" },
    },
  });
  if (values.help || !positionals.length) {
    console.log(help);
    return;
  }
  const command = positionals[0];
  if (
    positionals.length !== 1 ||
    !["auth", "list", "read", "send", "forward", "disconnect"].includes(command)
  )
    throw new Error(
      "Choose auth, list, read, send, forward, or disconnect. See --help.",
    );
  const account = email(values.account);
  if (["read", "forward"].includes(command) && !values.id)
    throw new Error("Provide --id from a list result.");
  const limit = Number(values.limit),
    skip = Number(values.skip);
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100 ||
    !Number.isSafeInteger(skip) ||
    skip < 0
  )
    throw new Error("--limit must be 1-100 and --skip a nonnegative integer.");
  let to = "",
    body = "";
  if (command === "forward") to = email(values.to);
  if (command === "send") {
    to = email(values.to);
    if (!values.subject?.trim() || /[\r\n]/.test(values.subject))
      throw new Error("Provide a nonempty single-line --subject.");
    if ((values.body !== undefined) === (values["body-file"] !== undefined))
      throw new Error("Provide exactly one of --body or --body-file.");
    body = values["body-file"]
      ? await readFile(values["body-file"], "utf8")
      : values.body;
    if (!body.trim()) throw new Error("Email body cannot be empty.");
  }
  const client = new MailClient(
    fileURLToPath(new URL("./.mail-accounts/", import.meta.url)),
    required("MICROSOFT_CLIENT_ID"),
    required("MICROSOFT_TENANT_ID"),
  );
  await client.locked(account, async () => {
    let result;
    switch (command) {
      case "auth":
        await client.auth(account);
        return;
      case "list":
        result = await client.list(
          account,
          values.folder,
          limit,
          skip,
          values.search,
        );
        break;
      case "read":
        result = await client.read(account, values.id);
        break;
      case "send":
        result = await client.send(account, to, values.subject, body);
        break;
      case "forward":
        result = await client.forward(account, values.id, to);
        break;
      case "disconnect":
        result = await client.disconnect(account);
        break;
    }
    console.log(JSON.stringify(result, null, 2));
  });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(
      error instanceof Error ? error.message : "Mail command failed.",
    );
    process.exitCode = 1;
  });
}
