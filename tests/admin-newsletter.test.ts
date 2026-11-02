import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import type { APIContext } from "astro";
import {
  identity,
  requireAdmin,
  requireSameOrigin,
  beginLogin,
  finishLogin,
} from "../src/lib/admin/auth.ts";
import { activeEmails } from "../src/lib/admin/recipients.ts";
import {
  decrypt,
  encrypt,
  digest,
  read,
  write,
} from "../src/lib/admin/store.ts";
import {
  campaign,
  messageHtml,
  progress,
  publish,
  saveDraft,
  sendNext,
  startDelivery,
  resolveDelivery,
} from "../src/lib/admin/campaigns.ts";
import {
  importNotionPage,
  notionPageId,
  richText,
  safeUrl,
  type ImportedPage,
} from "../src/lib/admin/notion.ts";
import {
  graphAccessToken,
  seedMicrosoftToken,
} from "../src/lib/admin/microsoft.ts";

const id = "bc7069f8-9d03-42b4-b75d-bb8f01fd1424";
const page: ImportedPage = {
  id,
  notionId: "3e3181f3b6ed80c6b392cdfb4bf9a3ef",
  title: "Edition <1>",
  html: "<p>Hello!</p>",
  createdAt: "2026-10-18T10:00:00Z",
  createdBy: "organizer",
};
function environment() {
  Object.assign(process.env, {
    NEWSLETTER_SITE_URL: "https://blog.example.com",
    NEWSLETTER_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
    UPSTASH_REDIS_REST_URL: "https://redis.example.com",
    UPSTASH_REDIS_REST_TOKEN: "storage-secret",
    NEWSLETTER_REDIS_PREFIX: "test:",
    MICROSOFT_CLIENT_ID: "ms-client",
    MICROSOFT_TENANT_ID: "ms-tenant",
    MICROSOFT_SENDER_EMAIL: "phackers@purdue.edu",
    PH_ID_CLIENT_ID: "ph-client",
    PH_ID_CLIENT_SECRET: "ph-secret",
    PH_ID_REQUIRED_ROLE: "organizer",
    NOTION_API_KEY: "notion-secret",
    NOTION_DATA_SOURCE_ID: "source",
    NOTION_DATABASE_ID: "database",
    NOTION_EMAIL_PROPERTY: "Email",
    NOTION_NAME_PROPERTY: "Name",
  });
}
function harness(t: TestContext) {
  environment();
  const strings = new Map<string, string>();
  const hashes = new Map<string, Map<string, string>>();
  const sorted = new Map<string, Map<string, number>>();
  const calls: { url: string; init?: RequestInit }[] = [];
  let roles: string[] = ["organizer"];
  let subscribers = ["reader@example.com", "other@example.com"];
  let unsubscribe = false;
  let sendMode = "ok";
  let failAcceptedWrite = false;
  let notionFailure = false;
  let mailbox = "phackers@purdue.edu";
  let blocks: unknown[] = [
    {
      id: "b1",
      type: "paragraph",
      has_children: false,
      paragraph: { rich_text: [{ plain_text: "Hello <script>" }] },
    },
  ];
  let notionPages = 1;
  let childQueries = 0;
  function row(email: string, unsubscribed = false) {
    return {
      properties: {
        Email: { email },
        Unsubscribed: { checkbox: unsubscribed },
      },
    };
  }
  t.mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, ...(init ? { init } : {}) });
      if (url === "https://redis.example.com/") {
        const command = JSON.parse(String(init?.body)) as (string | number)[];
        const op = command[0],
          k = String(command[1]);
        let result: unknown = null;
        if (op === "GET") result = strings.get(k) ?? null;
        else if (op === "GETDEL") {
          result = strings.get(k) ?? null;
          strings.delete(k);
        } else if (op === "SET") {
          if (command.includes("NX") && strings.has(k)) result = null;
          else {
            strings.set(k, String(command[2]));
            result = "OK";
          }
        } else if (op === "DEL") {
          strings.delete(k);
          result = 1;
        } else if (op === "HGETALL")
          result = [...(hashes.get(k) || new Map()).entries()].flat();
        else if (op === "HSET" || op === "HSETNX") {
          const h = hashes.get(k) || new Map<string, string>();
          hashes.set(k, h);
          if (op === "HSETNX" && h.has(String(command[2]))) result = 0;
          else {
            if (failAcceptedWrite && String(command[3]).includes('"accepted"'))
              throw new Error("Storage connection lost");
            h.set(String(command[2]), String(command[3]));
            result = 1;
          }
        } else if (op === "HDEL") {
          hashes.get(k)?.delete(String(command[2]));
          result = 1;
        } else if (op === "MGET")
          result = command
            .slice(1)
            .map((name) => strings.get(String(name)) ?? null);
        else if (op === "ZREVRANGE")
          result = [...(sorted.get(k) || new Map()).entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([value]) => value);
        else if (op === "EVAL") {
          if (String(command[1]).includes("'DEL'")) {
            const name = String(command[3]);
            if (strings.get(name) === command[4]) {
              strings.delete(name);
              result = 1;
            } else result = 0;
          } else {
            strings.set(String(command[3]), String(command[5]));
            const z =
              sorted.get(String(command[4])) || new Map<string, number>();
            z.set(String(command[7]), Number(command[6]));
            sorted.set(String(command[4]), z);
            result = 1;
          }
        } else throw new Error(`Unexpected command: ${op}`);
        return Response.json({ result });
      }
      if (url.includes("/oauth2/userinfo"))
        return Response.json({ sub: "user1", name: "Hacker", roles });
      if (url.includes("id.purduehackers.com") && url.endsWith("/token"))
        return Response.json({ access_token: "id-access", expires_in: 3600 });
      if (url.includes("login.microsoftonline.com"))
        return Response.json({
          access_token: "rotated-access",
          refresh_token: "rotated-refresh",
          expires_in: 3600,
        });
      if (url.includes("graph.microsoft.com") && url.includes("/me?"))
        return Response.json({ mail: mailbox });
      if (url.endsWith("/me/sendMail")) {
        if (sendMode === "timeout") throw new Error("timeout");
        if (sendMode === "reject") return new Response(null, { status: 429 });
        return new Response(null, { status: 202 });
      }
      if (url.includes("api.notion.com")) {
        if (notionFailure) return new Response(null, { status: 503 });
        if (url.includes("/data_sources/source/query")) {
          const query = JSON.parse(String(init?.body));
          const email = query.filter?.email?.equals;
          return Response.json({
            results: subscribers
              .filter((e) => !email || email === e)
              .map((e) => row(e, unsubscribe)),
            has_more: false,
            next_cursor: null,
          });
        }
        if (url.endsWith("/data_sources/source"))
          return Response.json({
            properties: {
              Email: { type: "email" },
              Unsubscribed: { type: "checkbox" },
            },
          });
        if (url.includes("/pages/"))
          return Response.json({
            properties: {
              Name: { type: "title", title: [{ plain_text: "Edition One" }] },
            },
          });
        if (url.includes("/children?")) {
          childQueries++;
          return Response.json({
            results: blocks,
            has_more: childQueries < notionPages,
            next_cursor: childQueries < notionPages ? "next" : null,
          });
        }
      }
      throw new Error(`Unexpected request: ${url}`);
    },
  );
  return {
    strings,
    hashes,
    calls,
    roles: (value: string[]) => {
      roles = value;
    },
    subscribers: (value: string[]) => {
      subscribers = value;
    },
    unsubscribed: () => {
      unsubscribe = true;
    },
    mode: (value: string) => {
      sendMode = value;
    },
    failSave: () => {
      failAcceptedWrite = true;
    },
    failNotion: () => {
      notionFailure = true;
    },
    mailbox: (value: string) => {
      mailbox = value;
    },
    blocks: (value: unknown[], pages = 1) => {
      blocks = value;
      notionPages = pages;
    },
    sends: () => calls.filter((call) => call.url.endsWith("/me/sendMail")),
    ready: async () => {
      await seedMicrosoftToken({
        access_token: "ms-access",
        refresh_token: "ms-refresh",
        expires_in: 3600,
      });
      await saveDraft({ ...page });
      await publish(id);
      await startDelivery(id);
    },
  };
}

test("organizers and admins are allowed; alumni, missing roles, and revoked roles are denied", async (t) => {
  const h = harness(t);
  assert.equal((await identity("id-access")).sub, "user1");
  h.roles(["organizer", "admin"]);
  assert.equal((await identity("id-access")).name, "Hacker");
  for (const roles of [["alumni"], [], ["organizer-admin"]]) {
    h.roles(roles);
    await assert.rejects(identity("id-access"), /requires.*organizer/);
  }
  const session = "a".repeat(43);
  await write(`session:${digest(session)}`, {
    token: encrypt("id-access"),
    sub: "user1",
    expires: Date.now() + 10000,
  });
  const context = {
    cookies: { get: () => ({ value: session }) },
  } as unknown as Pick<APIContext, "cookies">;
  h.roles(["organizer"]);
  assert.equal((await requireAdmin(context)).sub, "user1");
  h.roles(["alumni"]);
  await assert.rejects(requireAdmin(context), /requires.*organizer/);
});

test("sessions fail closed and cross-origin admin actions are rejected", async (t) => {
  harness(t);
  await assert.rejects(
    requireAdmin({ cookies: { get: () => undefined } } as unknown as Pick<
      APIContext,
      "cookies"
    >),
    /Sign in/,
  );
  for (const origin of [null, "https://other.example.com"]) {
    assert.throws(
      () =>
        requireSameOrigin(
          new Request("https://blog.example.com/api/admin/newsletters", {
            headers: origin ? { origin } : {},
          }),
        ),
      /admin page/,
    );
  }
  assert.doesNotThrow(() =>
    requireSameOrigin(
      new Request("https://blog.example.com/api/admin/newsletters", {
        headers: { origin: "https://blog.example.com" },
      }),
    ),
  );
});

test("OAuth binds state to a cookie, uses PKCE, consumes state once, and creates an encrypted server session", async (t) => {
  const h = harness(t);
  const cookies = new Map<string, string>();
  const context = {
    cookies: {
      get: (name: string) =>
        cookies.has(name) ? { value: cookies.get(name) } : undefined,
      set: (name: string, value: string) => cookies.set(name, value),
      delete: (name: string) => cookies.delete(name),
    },
    redirect: (url: string, status: number) =>
      new Response(null, { status, headers: { location: url } }),
    url: new URL("https://blog.example.com/admin/login"),
  } as unknown as APIContext;
  const response = await beginLogin(context);
  const authorize = new URL(response.headers.get("location")!);
  const state = authorize.searchParams.get("state")!;
  assert.equal(authorize.searchParams.get("code_challenge_method"), "S256");
  assert.equal(authorize.searchParams.get("scope"), "openid profile roles");
  assert.ok(authorize.searchParams.get("code_challenge"));
  context.url = new URL(
    `https://blog.example.com/admin/callback?state=${state}&code=code`,
  );
  assert.equal((await finishLogin(context)).status, 303);
  assert.ok(cookies.get("ph_newsletter_session"));
  const session = [...h.strings.entries()].find(([name]) =>
    name.includes("session:"),
  )![1];
  assert.ok(!session.includes("id-access"));
  await assert.rejects(finishLogin(context), /Invalid sign-in state/);
});

test("token encryption is authenticated and rotating Microsoft tokens persist before mail", async (t) => {
  const h = harness(t);
  const secret = encrypt("refresh-secret");
  assert.equal(decrypt(secret), "refresh-secret");
  assert.ok(!secret.includes("refresh-secret"));
  const bytes = Buffer.from(secret, "base64");
  bytes[30] = bytes[30]! ^ 1;
  assert.throws(() => decrypt(bytes.toString("base64")));
  await seedMicrosoftToken({
    access_token: "old-access",
    refresh_token: "old-refresh",
    expires_in: 0,
  });
  assert.equal(await graphAccessToken(), "rotated-access");
  const saved = await read<{ refresh: string; access: string }>("microsoft");
  assert.equal(decrypt(saved!.refresh), "rotated-refresh");
  assert.equal(decrypt(saved!.access), "rotated-access");
  assert.equal(h.sends().length, 0);
  h.mailbox("someone@purdue.edu");
  await assert.rejects(
    seedMicrosoftToken({
      access_token: "wrong-access",
      refresh_token: "wrong-refresh",
      expires_in: 3600,
    }),
    /Sign in as phackers/,
  );
});

test("recipient list deduplicates, excludes unsubscribes including duplicates, and handles rich text", () => {
  const row = (email: string, flag?: boolean) => ({
    properties: {
      Email: { email },
      Unsubscribed: { ...(flag === undefined ? {} : { checkbox: flag }) },
    },
  });
  assert.deepEqual(
    activeEmails([
      row(" Active@Example.com ", false),
      row("active@example.com", false),
      row("unsub@example.com", true),
      row("unsub@example.com", false),
      row("missing@example.com"),
      row("bad", false),
    ]),
    ["active@example.com"],
  );
  assert.deepEqual(
    activeEmails(
      [
        {
          properties: {
            Address: { rich_text: [{ plain_text: "reader@example.com" }] },
            Unsubscribed: { checkbox: false },
          },
        },
      ],
      "Address",
    ),
    ["reader@example.com"],
  );
});

test("Notion URLs are validated and text/links cannot inject HTML or scripts", () => {
  assert.equal(
    notionPageId(
      "https://app.notion.com/p/purduehackers/edition-1-3e3181f3b6ed80c6b392cdfb4bf9a3ef",
    ),
    page.notionId,
  );
  assert.throws(() =>
    notionPageId("https://evil.example/3e3181f3b6ed80c6b392cdfb4bf9a3ef"),
  );
  assert.equal(safeUrl("javascript:alert(1)"), null);
  assert.equal(safeUrl("data:text/html,evil"), null);
  assert.equal(
    richText([
      {
        plain_text: '<img src=x onerror="evil">',
        href: "javascript:alert(1)",
        annotations: { bold: true },
      },
    ]),
    "<strong>&lt;img src=x onerror=&quot;evil&quot;&gt;</strong>",
  );
});

test("Notion import paginates, keeps a snapshot, and rejects unsupported content", async (t) => {
  const h = harness(t);
  h.blocks(
    [
      {
        id: "b",
        type: "paragraph",
        has_children: false,
        paragraph: { rich_text: [{ plain_text: "Safe <text>" }] },
      },
    ],
    2,
  );
  const imported = await importNotionPage(page.notionId, "organizer");
  assert.equal(imported.title, "Edition One");
  assert.equal((imported.html.match(/Safe &lt;text&gt;/g) || []).length, 2);
  assert.equal(imported.publishedAt, undefined);
  h.blocks([
    {
      id: "b",
      type: "equation",
      has_children: false,
      equation: { expression: "x" },
    },
  ]);
  await assert.rejects(
    importNotionPage(page.notionId, "organizer"),
    /not supported/,
  );
  assert.equal(h.sends().length, 0);
});

test("publication is idempotent and email recipients remain private with encoded unsubscribe links", async (t) => {
  harness(t);
  await saveDraft({ ...page });
  const first = await publish(id);
  const second = await publish(id);
  assert.equal(first.publishedAt, second.publishedAt);
  const html = messageHtml(page, "reader+test@example.com");
  assert.ok(html.includes("email=reader%2Btest%40example.com"));
  assert.ok(html.includes("Edition &lt;1&gt;"));
  await assert.rejects(campaign("../secret"), /Invalid edition/);
});

test("delivery sends separate emails once, resumes, and never repeats completed recipients", async (t) => {
  const h = harness(t);
  await h.ready();
  await sendNext(id);
  await sendNext(id);
  await sendNext(id);
  assert.equal(h.sends().length, 2);
  for (const call of h.sends()) {
    const message = JSON.parse(String(call.init?.body)).message;
    assert.equal(message.toRecipients.length, 1);
    assert.equal(message.bccRecipients, undefined);
    assert.ok(message.body.content.includes("/unsubscribe?email="));
  }
  assert.equal((await progress(id)).accepted, 2);
  assert.equal((await progress(id)).remaining, 0);
});

test("unsubscribing after audience capture skips sending, and Notion failure sends nothing", async (t) => {
  const h = harness(t);
  await h.ready();
  h.unsubscribed();
  await sendNext(id);
  assert.equal(h.sends().length, 0);
  assert.equal((await progress(id)).skipped, 1);
  h.failNotion();
  await assert.rejects(sendNext(id), /Notion request failed/);
  assert.equal(h.sends().length, 0);
});

test("uncertain delivery stops automatic sends until an organizer reviews it", async (t) => {
  const h = harness(t);
  await h.ready();
  h.mode("timeout");
  await sendNext(id);
  await sendNext(id);
  assert.equal(h.sends().length, 1);
  assert.equal((await progress(id)).uncertain, 1);
  const issue = (await progress(id)).issues[0]!;
  await resolveDelivery(id, issue.email, "skip");
  h.mode("ok");
  await sendNext(id);
  assert.equal(h.sends().length, 2);
  assert.equal((await progress(id)).skipped, 1);
});

test("a crash after Microsoft accepts leaves a durable pending claim and does not resend", async (t) => {
  const h = harness(t);
  await h.ready();
  h.failSave();
  await assert.rejects(sendNext(id), /Storage connection lost/);
  await sendNext(id);
  assert.equal(h.sends().length, 1);
  assert.equal((await progress(id)).uncertain, 1);
});

test("definite Microsoft rejection requires review before retry, and unpublished editions cannot send", async (t) => {
  const h = harness(t);
  await saveDraft({ ...page });
  await assert.rejects(startDelivery(id), /Publish/);
  await h.ready();
  h.mode("reject");
  await sendNext(id);
  assert.equal((await progress(id)).failed, 1);
  const issue = (await progress(id)).issues[0]!;
  await resolveDelivery(id, issue.email, "retry");
  h.mode("ok");
  await sendNext(id);
  assert.equal((await progress(id)).accepted, 1);
  assert.equal(h.sends().length, 2);
});

test("concurrent delivery continuations cannot submit the same recipient twice", async (t) => {
  const h = harness(t);
  await h.ready();
  const results = await Promise.allSettled([sendNext(id), sendNext(id)]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(h.sends().length, 1);
  assert.equal((await progress(id)).accepted, 1);
});

test("a refreshed token is not cached as usable when mailbox verification fails", async (t) => {
  const h = harness(t);
  await seedMicrosoftToken({
    access_token: "ms-access",
    refresh_token: "ms-refresh",
    expires_in: 0,
  });
  h.mailbox("wrong@purdue.edu");
  await assert.rejects(graphAccessToken(), /Sign in as phackers/);
  assert.equal((await read<{ expires: number }>("microsoft"))!.expires, 0);
  await assert.rejects(graphAccessToken(), /Sign in as phackers/);
});
