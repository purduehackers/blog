import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import https from "node:https";
import sharp from "sharp";
import { randomBytes } from "node:crypto";
import type { ClientRequest, IncomingMessage } from "node:http";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { database, closeDatabase, sql } from "../src/lib/admin/database.ts";
import { migrateDatabase } from "../src/lib/admin/schema.ts";
import type { APIContext } from "astro";
import { exchangeIdCode } from "../src/lib/admin/id-token.ts";
import { AdminSetupError, siteOrigin } from "../src/lib/admin/config.ts";
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
  getMicrosoftCredential,
  getMedia,
  saveSession,
  getEdition,
  getAudience,
  createAudience,
  saveOAuthState,
  consumeOAuthState,
  getSession,
  locked,
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
  microsoftConsentScope,
  microsoftMailScope,
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
    TURSO_AUTH_TOKEN: "unused-local-test-token",
    BLOG_STORAGE_TURSO_DATABASE_URL: "",
    BLOG_STORAGE_TURSO_AUTH_TOKEN: "",
    MICROSOFT_CLIENT_ID: "ms-client",
    MICROSOFT_TENANT_ID: "ms-tenant",
    MICROSOFT_SENDER_EMAIL: "phackers@purdue.edu",
    PH_ID_CLIENT_ID: "ph-client",
    PH_ID_CLIENT_SECRET: "ph-secret",
    PH_ID_TOKEN_AUTH_METHOD: "client_secret_basic",
    PH_ID_REQUIRED_ROLE: "organizer",
    NOTION_API_KEY: "notion-secret",
    NOTION_DATA_SOURCE_ID: "source",
    NOTION_DATABASE_ID: "database",
    NOTION_EMAIL_PROPERTY: "Email",
    NOTION_NAME_PROPERTY: "Name",
  });
}
async function harness(t: TestContext) {
  environment();
  const directory = mkdtempSync(join(tmpdir(), "ph-newsletter-test-"));
  process.env.TURSO_DATABASE_URL = `file:${join(directory, "newsletter.db")}`;
  t.after(() => {
    closeDatabase();
    rmSync(directory, { recursive: true, force: true });
  });
  await migrateDatabase(database());
  const calls: { url: string; init?: RequestInit }[] = [];
  let roles: string[] = ["organizer"];
  let idTokenError = "";
  t.mock.method(https, "request", ((
    url: string | URL,
    options: https.RequestOptions,
    callback: (response: IncomingMessage) => void,
  ) => {
    const request = new EventEmitter() as EventEmitter & {
      end: (body: string) => void;
      destroy: (error: Error) => void;
    };
    request.destroy = (error) => {
      request.emit("error", error);
      request.emit("close");
    };
    request.end = (body) => {
      calls.push({
        url: String(url),
        init: {
          method: "POST",
          body,
          headers: options.headers as Record<string, string>,
        },
      });
      const data = idTokenError
        ? { error: idTokenError, error_description: "private-provider-detail" }
        : { access_token: "id-access", expires_in: 3600 };
      const response = Object.assign(
        Readable.from([Buffer.from(JSON.stringify(data))]),
        { statusCode: idTokenError ? 401 : 200 },
      );
      response.on("end", () => request.emit("close"));
      callback(response as unknown as IncomingMessage);
    };
    return request as unknown as ClientRequest;
  }) as typeof https.request);
  let subscribers = ["reader@example.com", "other@example.com"];
  let unsubscribe = false;
  let sendMode = "ok";
  let notionFailure = 0;
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
  let imageBody: Uint8Array = new Uint8Array([137, 80, 78, 71]);
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
      if (url.startsWith("https://files.notion-static.com/"))
        return new Response(Buffer.from(imageBody), {
          headers: { "Content-Type": "image/png" },
        });
      if (url.includes("/oauth2/userinfo"))
        return Response.json({ sub: "user1", name: "Hacker", roles });
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
        if (notionFailure) return new Response(null, { status: notionFailure });
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
    image: (body: Uint8Array) => {
      imageBody = body;
    },
    calls,
    tokenError: (value: string) => {
      idTokenError = value;
    },
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
    failSave: () =>
      sql(
        `CREATE TRIGGER fail_accepted BEFORE UPDATE ON newsletter_recipients WHEN NEW.status='accepted' BEGIN SELECT RAISE(FAIL, 'Storage connection lost'); END`,
      ),
    failNotion: (status = 503) => {
      notionFailure = status;
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
      if (!(await getEdition(id))) await saveDraft({ ...page });
      await publish(id);
      await startDelivery(id);
    },
  };
}

test("organizers and admins are allowed; alumni, missing roles, and revoked roles are denied", async (t) => {
  const h = await harness(t);
  assert.equal((await identity("id-access")).sub, "user1");
  h.roles(["organizer", "admin"]);
  assert.equal((await identity("id-access")).name, "Hacker");
  for (const roles of [["alumni"], [], ["organizer-admin"]]) {
    h.roles(roles);
    await assert.rejects(identity("id-access"), /requires.*organizer/);
  }
  const session = "a".repeat(43);
  await saveSession(digest(session), {
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
  await harness(t);
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
  const h = await harness(t);
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
  const exchange = h.calls.find((call) => call.url.endsWith("/oauth2/token"))!;
  const headers = new Headers(exchange.init?.headers);
  assert.equal(
    headers.get("Authorization"),
    `Basic ${Buffer.from("ph-client:ph-secret").toString("base64")}`,
  );
  assert.equal(headers.get("Origin"), null);
  assert.equal(headers.get("Cookie"), null);
  assert.equal(headers.get("Sec-Fetch-Mode"), null);
  const exchangedBody = new URLSearchParams(String(exchange.init?.body));
  assert.equal(exchangedBody.has("client_secret"), false);
  assert.equal(
    exchangedBody.get("redirect_uri"),
    "https://blog.example.com/admin/callback",
  );
  const sessions = await sql("SELECT token FROM newsletter_sessions");
  assert.equal(sessions.rows.length, 1);
  assert.ok(!String(sessions.rows[0]!.token).includes("id-access"));
  await assert.rejects(finishLogin(context), /Invalid sign-in state/);
});

test("token encryption is authenticated and rotating Microsoft tokens persist before mail", async (t) => {
  const h = await harness(t);
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
  const saved = await getMicrosoftCredential();
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
  const h = await harness(t);
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
      equation: { expression: "✦ <script>" },
    },
  ]);
  const equation = await importNotionPage(page.notionId, "organizer");
  assert.match(equation.html, /✦ &lt;script&gt;/);
  assert.equal(richText([{ equation: { expression: "x < y" } }]), "x &lt; y");
  h.blocks([{ id: "unsupported", type: "unsupported", has_children: false }]);
  await assert.rejects(
    importNotionPage(page.notionId, "organizer"),
    /not supported/,
  );
  assert.equal(h.sends().length, 0);
});

test("publication is idempotent and email recipients remain private with encoded unsubscribe links", async (t) => {
  await harness(t);
  await saveDraft({ ...page });
  const first = await publish(id);
  const second = await publish(id);
  assert.equal(first.publishedAt, second.publishedAt);
  const html = messageHtml(page, "reader+test@example.com");
  assert.ok(html.includes(`https://blog.example.com/posts/${page.id}`));
  assert.ok(!html.includes(`/newsletter/${page.id}`));
  assert.ok(html.includes("email=reader%2Btest%40example.com"));
  assert.ok(html.includes("Edition &lt;1&gt;"));
  await assert.rejects(campaign("../secret"), /Invalid edition/);
});

test("delivery sends separate emails once, resumes, and never repeats completed recipients", async (t) => {
  const h = await harness(t);
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
  const h = await harness(t);
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
  const h = await harness(t);
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
  const h = await harness(t);
  await h.ready();
  await h.failSave();
  await assert.rejects(sendNext(id), /Storage connection lost/);
  closeDatabase(); // Simulate a cold start against the same SQLite file.
  await sendNext(id);
  assert.equal(h.sends().length, 1);
  assert.equal((await progress(id)).uncertain, 1);
});

test("definite Microsoft rejection requires review before retry, and unpublished editions cannot send", async (t) => {
  const h = await harness(t);
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
  const h = await harness(t);
  await h.ready();
  const results = await Promise.allSettled([sendNext(id), sendNext(id)]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(h.sends().length, 1);
  assert.equal((await progress(id)).accepted, 1);
});

test("a refreshed token is not cached as usable when mailbox verification fails", async (t) => {
  const h = await harness(t);
  await seedMicrosoftToken({
    access_token: "ms-access",
    refresh_token: "ms-refresh",
    expires_in: 0,
  });
  h.mailbox("wrong@purdue.edu");
  await assert.rejects(graphAccessToken(), /Sign in as phackers/);
  assert.equal((await getMicrosoftCredential())!.expires, 0);
  await assert.rejects(graphAccessToken(), /Sign in as phackers/);
});

test("Notion-hosted images are copied to permanent site URLs instead of keeping expiring links", async (t) => {
  const h = await harness(t);
  h.blocks([
    {
      id: "image1",
      type: "image",
      has_children: false,
      image: {
        type: "file",
        file: { url: "https://files.notion-static.com/photo.png?expires=soon" },
        caption: [{ plain_text: "Hack Night <photo>" }],
      },
    },
  ]);
  const imported = await importNotionPage(page.notionId, "organizer");
  assert.ok(!imported.html.includes("expires=soon"));
  assert.ok(imported.html.includes("Hack Night &lt;photo&gt;"));
  const mediaId = imported.html.match(/newsletter-media\/([a-f\d-]+)/)![1]!;
  const media = await getMedia(mediaId);
  assert.equal(media!.campaignId, imported.id);
  assert.equal(media!.type, "image/png");
  assert.equal(Buffer.from(media!.body, "base64").length, 4);
  assert.equal(h.sends().length, 0);
});

test("oversized Notion images are optimized and stored within the email image limit", async (t) => {
  const h = await harness(t);
  const original = await sharp(randomBytes(1100 * 1100 * 3), {
    raw: { width: 1100, height: 1100, channels: 3 },
  })
    .png({ compressionLevel: 0 })
    .toBuffer();
  assert.ok(original.length > 2000000);
  h.image(original);
  h.blocks([
    {
      id: "large-image",
      type: "image",
      has_children: false,
      image: {
        type: "file",
        file: { url: "https://files.notion-static.com/large.png" },
      },
    },
  ]);
  const imported = await importNotionPage(page.notionId, "organizer");
  const mediaId = imported.html.match(/newsletter-media\/([a-f\d-]+)/)![1]!;
  const media = await getMedia(mediaId);
  const body = Buffer.from(media!.body, "base64");
  assert.ok(body.length <= 2000000);
  assert.equal((await sharp(body).metadata()).width, 1100);
  assert.equal(media!.type, "image/jpeg");
  assert.equal(h.sends().length, 0);
});

test("unrecognized file hosts fail import without fetching them", async (t) => {
  const h = await harness(t);
  h.blocks([
    {
      id: "image1",
      type: "image",
      has_children: false,
      image: {
        type: "file",
        file: { url: "https://untrusted.example/image.png" },
      },
    },
  ]);
  await assert.rejects(
    importNotionPage(page.notionId, "organizer"),
    /Unrecognized Notion image host/,
  );
  assert.ok(!h.calls.some((call) => call.url.includes("untrusted.example")));
});

test("schema setup can run again without changing saved editions or credentials", async (t) => {
  const h = await harness(t);
  await h.ready();
  const before = await getMicrosoftCredential();
  await migrateDatabase(database());
  closeDatabase();
  assert.deepEqual(await getMicrosoftCredential(), before);
  assert.equal((await campaign(id)).title, page.title);
  assert.equal((await progress(id)).total, 2);
});

test("audience creation rolls back every row on failure and cannot append to a frozen audience", async (t) => {
  await harness(t);
  await saveDraft({ ...page });
  await assert.rejects(
    createAudience(id, ["duplicate@example.com", "duplicate@example.com"]),
  );
  assert.equal(await getAudience(id), null);
  assert.equal(
    (await sql("SELECT COUNT(*) AS count FROM newsletter_recipients")).rows[0]!
      .count,
    0,
  );
  await createAudience(id, ["reader@example.com"]);
  await assert.rejects(createAudience(id, ["new@example.com"]));
  assert.deepEqual((await getAudience(id))!.emails, ["reader@example.com"]);
});

test("OAuth state is single-use across concurrent consumers and expired auth rows cannot authorize", async (t) => {
  await harness(t);
  await saveOAuthState("state", "verifier");
  const consumed = await Promise.all([
    consumeOAuthState("state"),
    consumeOAuthState("state"),
  ]);
  assert.deepEqual(consumed.sort(), [null, "verifier"].sort());
  await saveOAuthState("expired", "old-verifier");
  await sql(
    "UPDATE newsletter_oauth_states SET expires_at=0 WHERE id='expired'",
  );
  assert.equal(await consumeOAuthState("expired"), null);
  await saveSession("expired-session", {
    token: encrypt("access"),
    sub: "user1",
    expires: Date.now() - 1,
  });
  assert.equal(await getSession("expired-session"), null);
});

test("leases exclude other owners, expire using the database clock, and only release their own ownership", async (t) => {
  await harness(t);
  await locked("test-lease", async () => {
    await assert.rejects(
      locked("test-lease", async () => undefined),
      /Another operation/,
    );
    await sql(
      "UPDATE newsletter_leases SET owner='replacement-owner' WHERE name='test-lease'",
    );
  });
  assert.equal(
    (await sql("SELECT owner FROM newsletter_leases WHERE name='test-lease'"))
      .rows[0]!.owner,
    "replacement-owner",
  );
  await sql(
    "UPDATE newsletter_leases SET expires_at=0 WHERE name='test-lease'",
  );
  await locked("test-lease", async () => undefined);
  assert.equal(
    (await sql("SELECT COUNT(*) AS count FROM newsletter_leases")).rows[0]!
      .count,
    0,
  );
});

test("Vercel BLOG_STORAGE_ variables take precedence and tokens stay paired with their database", async (t) => {
  await harness(t);
  await saveDraft({ ...page });
  process.env.BLOG_STORAGE_TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL!;
  process.env.TURSO_DATABASE_URL = "invalid-unprefixed-url";
  closeDatabase();
  assert.equal((await campaign(id)).title, page.title);
  process.env.BLOG_STORAGE_TURSO_DATABASE_URL = "libsql://prefixed.example.com";
  process.env.BLOG_STORAGE_TURSO_AUTH_TOKEN = "prefixed-token";
  assert.equal(database().protocol, "http");
  process.env.BLOG_STORAGE_TURSO_AUTH_TOKEN = "";
  assert.throws(database, /Configure BLOG_STORAGE_TURSO_AUTH_TOKEN/);
});

test("mailbox capture requests calendar consent while newsletter refreshes stay mail-only", async (t) => {
  const h = await harness(t);
  const consent = microsoftConsentScope.split(" ");
  assert.ok(
    consent.includes("https://graph.microsoft.com/Calendars.ReadWrite"),
  );
  assert.ok(consent.includes("https://graph.microsoft.com/Mail.Send"));
  assert.ok(consent.includes("https://graph.microsoft.com/User.Read"));
  assert.ok(consent.includes("offline_access"));
  await seedMicrosoftToken({
    access_token: "broad-consent-token",
    refresh_token: "refresh-token",
    expires_in: 3600,
  });
  assert.equal((await getMicrosoftCredential())!.expires, 0);
  assert.equal(await graphAccessToken(), "rotated-access");
  const refresh = h.calls.find(
    (call) =>
      call.url.includes("login.microsoftonline.com") &&
      call.url.endsWith("/token"),
  )!;
  const body = new URLSearchParams(String(refresh.init?.body));
  assert.equal(body.get("scope"), microsoftMailScope);
  assert.ok(!body.get("scope")!.includes("Calendars."));
  assert.equal(h.sends().length, 0);
});

test("a missing newsletter schema gives an actionable sign-in error", async (t) => {
  await harness(t);
  await sql("DROP TABLE newsletter_oauth_states");
  await assert.rejects(
    beginLogin({} as APIContext),
    (error: unknown) =>
      error instanceof AdminSetupError &&
      /npm run newsletter:setup/.test(error.message),
  );
});

test("a local site URL without its protocol fails before writing OAuth state", async (t) => {
  await harness(t);
  process.env.NEWSLETTER_SITE_URL = "localhost:3000";
  assert.throws(
    siteOrigin,
    (error: unknown) =>
      error instanceof AdminSetupError &&
      /http:\/\/localhost:3000/.test(error.message),
  );
  await assert.rejects(beginLogin({} as APIContext), AdminSetupError);
  assert.equal(
    (await sql("SELECT COUNT(*) AS count FROM newsletter_oauth_states"))
      .rows[0]!.count,
    0,
  );
});

test("ID token exchange supports explicitly registered POST clients and encodes Basic credentials correctly", async (t) => {
  const h = await harness(t);
  process.env.PH_ID_TOKEN_AUTH_METHOD = "client_secret_post";
  await exchangeIdCode(
    "test-code",
    "verifier",
    "http://localhost:3000/admin/callback",
  );
  const post = h.calls.at(-1)!;
  assert.equal(new Headers(post.init?.headers).has("Authorization"), false);
  assert.equal(
    new URLSearchParams(String(post.init?.body)).get("client_secret"),
    "ph-secret",
  );
  process.env.PH_ID_TOKEN_AUTH_METHOD = "client_secret_basic";
  process.env.PH_ID_CLIENT_ID = "client: space+/";
  process.env.PH_ID_CLIENT_SECRET = "secret: space+/";
  await exchangeIdCode(
    "test-code",
    "verifier",
    "http://localhost:3000/admin/callback",
  );
  const auth = new Headers(h.calls.at(-1)!.init?.headers).get("Authorization")!;
  assert.equal(
    Buffer.from(auth.slice("Basic ".length), "base64").toString(),
    "client%3A+space%2B%2F:secret%3A+space%2B%2F",
  );
});

test("ID token failures explain safe error codes without exposing provider details or creating sessions", async (t) => {
  const h = await harness(t);
  for (const [reason, expected] of [
    ["invalid_client", /PH_ID_TOKEN_AUTH_METHOD/],
    ["invalid_grant", /Start a new sign-in/],
    ["invalid_request", /authentication method/],
    ["unknown_provider_code", /HTTP 401/],
  ] as const) {
    h.tokenError(reason);
    const state = `state-${reason}`;
    await saveOAuthState(digest(state), "verifier");
    const context = {
      url: new URL(
        `http://localhost:3000/admin/callback?state=${state}&code=not-a-real-code`,
      ),
      cookies: { get: () => ({ value: state }), delete: () => undefined },
    } as unknown as APIContext;
    await assert.rejects(
      finishLogin(context),
      (error: unknown) =>
        error instanceof Error &&
        expected.test(error.message) &&
        !error.message.includes("private-provider-detail") &&
        !error.message.includes("ph-secret"),
    );
  }
  assert.equal(
    (await sql("SELECT COUNT(*) AS count FROM newsletter_sessions")).rows[0]!
      .count,
    0,
  );
});

test("Notion access errors explain how to connect an edition instead of looking like an empty import", async (t) => {
  const h = await harness(t);
  h.failNotion(404);
  await assert.rejects(
    importNotionPage(page.notionId, "organizer"),
    /Connections.*integration/,
  );
  h.failNotion(403);
  await assert.rejects(
    importNotionPage(page.notionId, "organizer"),
    /Read content permission/,
  );
  assert.equal(h.sends().length, 0);
});
