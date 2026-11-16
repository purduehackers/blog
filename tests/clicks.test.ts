import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { database, closeDatabase, sql } from "../src/lib/admin/database.ts";
import { migrateDatabase } from "../src/lib/admin/schema.ts";
import {
  trackedLinks,
  verifyClick,
  recordClick,
  clickSummary,
} from "../src/lib/admin/clicks.ts";

test("links are signed and source-bound; unique browsers deduplicate across channels", async () => {
  const dir = mkdtempSync(join(tmpdir(), "clicks-"));
  process.env.BLOG_STORAGE_TURSO_DATABASE_URL = "";
  process.env.TURSO_DATABASE_URL = `file:${join(dir, "test.db")}`;
  process.env.NEWSLETTER_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString(
    "base64",
  );
  process.env.NEWSLETTER_SITE_URL = "https://blog.purduehackers.com";
  try {
    await migrateDatabase(database());
    await migrateDatabase(database());
    const html = trackedLinks(
      '<a href="https://example.com/?a=1&amp;b=2">Go</a><a href="#section">Jump</a><a href="mailto:a@example.com">Mail</a>',
      "edition",
      "web",
    );
    const link = new URL(
      html.match(/href="([^"]+)"/)![1]!.replaceAll("&amp;", "&"),
    );
    const target = link.searchParams.get("url")!;
    const signature = link.searchParams.get("signature")!;
    assert.equal(target, "https://example.com/?a=1&b=2");
    assert.ok(verifyClick("edition", "web", target, signature));
    assert.equal(verifyClick("edition", "email", target, signature), false);
    assert.equal(
      verifyClick("edition", "web", "https://evil.example/", signature),
      false,
    );
    assert.ok(html.includes('href="#section"'));
    assert.ok(html.includes('href="mailto:a@example.com"'));
    await sql(
      `INSERT INTO newsletter_editions VALUES ('edition','notion','Title','','today','admin','today'), ('draft','notion','Draft','','today','admin',NULL)`,
    );
    await recordClick("edition", "web", target, "a");
    await recordClick("edition", "web", target, "a");
    await recordClick("edition", "email", target, "a");
    await recordClick("edition", "email", target, "b");
    await recordClick("draft", "web", target, "a");
    const summary = await clickSummary("edition");
    assert.deepEqual(summary.totals, {
      web: { clicks: 2, visitors: 1 },
      email: { clicks: 2, visitors: 2 },
      combined: { clicks: 4, visitors: 2 },
    });
    assert.equal(summary.links.length, 1);
    assert.equal((await clickSummary("draft")).totals.combined!.clicks, 0);
  } finally {
    closeDatabase();
    rmSync(dir, { recursive: true, force: true });
  }
});
