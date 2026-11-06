import test from "node:test";
import assert from "node:assert/strict";
import { main } from "../scripts/send-test-email.ts";

const args = [
  "--login",
  "--from",
  "tester@purdue.edu",
  "--to",
  "recipient@example.com",
  "--subject",
  "Test subject",
  "--body",
  "Hello\nWorld",
];

test("test-email validates fields before contacting Microsoft", async (t) => {
  const network = t.mock.method(globalThis, "fetch", async () => {
    throw new Error("Unexpected network request");
  });
  await assert.rejects(main([]), /--from/);
  await assert.rejects(
    main([...args, "--to", "a@example.com,b@example.com"]),
    /--to/,
  );
  await assert.rejects(
    main([...args, "--from", "someone@example.com"]),
    /purdue.edu/,
  );
  await assert.rejects(
    main([...args, "--subject", "Bad\nSubject"]),
    /single-line/,
  );
  assert.equal(network.mock.callCount(), 0);
});

test("separate login sends exactly one plain-text message without saving credentials", async (t) => {
  process.env.MICROSOFT_CLIENT_ID = "test-client";
  process.env.MICROSOFT_TENANT_ID = "test-tenant";
  const requests: { url: string; init: RequestInit | undefined }[] = [];
  t.mock.method(console, "log", () => {});
  t.mock.method(
    globalThis,
    "fetch",
    async (url: string, init?: RequestInit) => {
      requests.push({ url, init });
      if (url.endsWith("/devicecode"))
        return Response.json({
          message: "Test sign-in",
          device_code: "test-device",
          expires_in: 60,
        });
      if (url.endsWith("/token"))
        return Response.json({ access_token: "test-access" });
      if (url.includes("/me?"))
        return Response.json({ mail: "tester@purdue.edu" });
      if (url.endsWith("/me/sendMail"))
        return new Response(null, { status: 202 });
      throw new Error("Unexpected request");
    },
  );
  await main(args);
  assert.equal(requests.length, 4);
  const sends = requests.filter((request) => request.url.endsWith("/sendMail"));
  assert.equal(sends.length, 1);
  assert.deepEqual(JSON.parse(String(sends[0]!.init?.body)), {
    message: {
      from: { emailAddress: { address: "tester@purdue.edu" } },
      toRecipients: [{ emailAddress: { address: "recipient@example.com" } }],
      subject: "Test subject",
      body: { contentType: "Text", content: "Hello\nWorld" },
    },
    saveToSentItems: true,
  });
  assert.ok(!String(requests[0]!.init?.body).includes("offline_access"));
});

test("separate login refuses to send from a different signed-in mailbox", async (t) => {
  process.env.MICROSOFT_CLIENT_ID = "test-client";
  process.env.MICROSOFT_TENANT_ID = "test-tenant";
  t.mock.method(console, "log", () => {});
  let sent = false;
  t.mock.method(globalThis, "fetch", async (url: string) => {
    if (url.endsWith("/devicecode"))
      return Response.json({
        message: "Test sign-in",
        device_code: "test-device",
        expires_in: 60,
      });
    if (url.endsWith("/token"))
      return Response.json({ access_token: "test-access" });
    if (url.includes("/me?"))
      return Response.json({ mail: "other@purdue.edu" });
    sent = true;
    throw new Error("Unexpected send");
  });
  await assert.rejects(main(args), /does not match/);
  assert.equal(sent, false);
});
