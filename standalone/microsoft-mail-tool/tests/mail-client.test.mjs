import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { MailClient } from "../lib/mail-client.mjs";
import { main } from "../mail.mjs";

test("saved mail connections encrypt, refresh, isolate accounts, and send once", async (t) => {
  process.env.MAIL_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  const directory = await mkdtemp(join(tmpdir(), "mail-client-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  let now = Date.now();
  t.mock.method(Date, "now", () => now);
  let signedIn = "one@example.com";
  let failSend = false;
  let failRefresh = false;
  let rotated = 0;
  const sends = [];
  const forwards = [];
  const requests = [];
  const request = async (input, init) => {
    const url = String(input);
    requests.push(url);
    if (url.endsWith("/devicecode")) {
      assert.match(String(init?.body), /offline_access/);
      assert.deepEqual(
        new URLSearchParams(String(init?.body)).get("scope")?.split(" ").sort(),
        [
          "offline_access",
          "https://graph.microsoft.com/User.Read",
          "https://graph.microsoft.com/Mail.ReadWrite",
          "https://graph.microsoft.com/Calendars.ReadWrite",
          "https://graph.microsoft.com/Mail.Send",
        ].sort(),
      );
      return Response.json({
        message: "Mock sign-in",
        device_code: "secret-device",
        expires_in: 600,
        interval: 5,
      });
    }
    if (url.endsWith("/token")) {
      const params = new URLSearchParams(String(init?.body));
      if (params.get("grant_type") === "refresh_token") {
        if (failRefresh)
          return Response.json({ error: "invalid_grant" }, { status: 400 });
        assert.equal(
          params.get("refresh_token"),
          rotated ? "rotated-refresh" : "secret-refresh",
        );
        rotated++;
        return Response.json({
          access_token: "rotated-access",
          refresh_token: "rotated-refresh",
          expires_in: 3600,
        });
      }
      return Response.json({
        access_token: "secret-access",
        refresh_token: "secret-refresh",
        expires_in: 3600,
      });
    }
    if (url.includes("/me?")) return Response.json({ mail: signedIn });
    if (url.endsWith("/sendMail")) {
      sends.push(JSON.parse(String(init?.body)));
      if (failSend) throw new Error("timeout");
      return new Response(null, { status: 202 });
    }
    if (url.endsWith("/forward")) {
      assert.ok(url.includes("message%2Fid/forward"));
      forwards.push(JSON.parse(String(init?.body)));
      return new Response(null, { status: 202 });
    }
    if (url.includes("/messages/")) {
      assert.equal(init?.method, undefined);
      return Response.json({
        id: "message/id",
        body: { contentType: "text", content: "Hello" },
      });
    }
    if (url.includes("/messages?"))
      return Response.json({ value: [{ id: "message/id", subject: "Hello" }] });
    throw new Error(`Unexpected URL ${url}`);
  };
  const client = new MailClient(
    directory,
    "client",
    "tenant",
    request,
    async () => {},
  );
  const run = (account, action) => client.locked(account, action);
  const logs = [];
  await run("one@example.com", () =>
    client.auth("one@example.com", (value) => logs.push(value)),
  );
  const encrypted = (await readdir(directory)).find((name) =>
    name.endsWith(".enc"),
  );
  const ciphertext = await readFile(join(directory, encrypted), "utf8");
  assert.ok(
    !ciphertext.includes("secret-access") &&
      !ciphertext.includes("secret-refresh") &&
      !ciphertext.includes("one@example.com"),
  );
  assert.equal((await stat(join(directory, encrypted))).mode & 0o777, 0o600);
  assert.ok(!logs.join().includes("secret-access"));

  // A new process/client can use the encrypted connection without sign-in.
  const restarted = new MailClient(directory, "client", "tenant", request);
  const listed = await run("one@example.com", () =>
    restarted.list("one@example.com", "inbox", 10, 0),
  );
  assert.equal(listed.value[0].subject, "Hello");
  await assert.rejects(
    run("two@example.com", () =>
      client.list("two@example.com", "inbox", 10, 0),
    ),
    /Connect two@example\.com first\. Run: npm run mail -- auth --account 'two@example\.com'/,
  );
  signedIn = "two@example.com";
  await assert.rejects(
    run("one@example.com", () => client.auth("one@example.com", () => {})),
    /Sign-in must match/,
  );
  assert.equal(await readFile(join(directory, encrypted), "utf8"), ciphertext);
  signedIn = "one@example.com";

  now += 3600000;
  await run("one@example.com", () =>
    restarted.read("one@example.com", "message/id"),
  );
  assert.equal(rotated, 1);
  assert.ok(requests.some((url) => url.includes("message%2Fid")));
  const sent = await run("one@example.com", () =>
    restarted.send(
      "one@example.com",
      "to@example.com",
      "Custom subject",
      "Custom body",
    ),
  );
  assert.equal(sent.accepted, true);
  await run("one@example.com", () =>
    restarted.forward("one@example.com", "message/id", "recipient@example.com"),
  );
  assert.deepEqual(forwards, [
    { toRecipients: [{ emailAddress: { address: "recipient@example.com" } }] },
  ]);
  assert.deepEqual(sends[0], {
    message: {
      from: { emailAddress: { address: "one@example.com" } },
      toRecipients: [{ emailAddress: { address: "to@example.com" } }],
      subject: "Custom subject",
      body: { contentType: "Text", content: "Custom body" },
    },
    saveToSentItems: true,
  });
  failSend = true;
  await assert.rejects(
    run("one@example.com", () =>
      restarted.send("one@example.com", "to@example.com", "Subject", "Body"),
    ),
    /Check Sent Items/,
  );
  assert.equal(sends.length, 2); // No automatic retry after timeout.
  now += 3600000;
  failRefresh = true;
  await assert.rejects(
    run("one@example.com", () =>
      restarted.list("one@example.com", "inbox", 10, 0),
    ),
    /invalid_grant/,
  );
  await run("one@example.com", async () => {
    await assert.rejects(
      client.locked("one@example.com", async () => {}),
      /Another mail command/,
    );
  });
  await run("one@example.com", () => restarted.disconnect("one@example.com"));
  assert.equal((await readdir(directory)).length, 0);
});

test("mail CLI validates send and read inputs before authenticating", async (t) => {
  const network = t.mock.method(globalThis, "fetch", async () => {
    throw new Error("Unexpected request");
  });
  await assert.rejects(
    main([
      "send",
      "--account",
      "one@example.com",
      "--to",
      "a@example.com,b@example.com",
    ]),
    /valid email/,
  );
  await assert.rejects(
    main([
      "send",
      "--account",
      "one@example.com",
      "--to",
      "a@example.com",
      "--subject",
      "Hi\nthere",
    ]),
    /single-line/,
  );
  await assert.rejects(
    main([
      "send",
      "--account",
      "one@example.com",
      "--to",
      "a@example.com",
      "--subject",
      "Hi",
      "--body",
      "Hi",
      "--body-file",
      "body.txt",
    ]),
    /exactly one/,
  );
  await assert.rejects(main(["read", "--account", "one@example.com"]), /--id/);
  await assert.rejects(
    main(["list", "--account", "one@example.com", "--limit", "101"]),
    /--limit/,
  );
  assert.equal(network.mock.callCount(), 0);
});
