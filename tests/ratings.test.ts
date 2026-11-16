import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { database, closeDatabase, sql } from "../src/lib/admin/database.ts";
import { migrateDatabase } from "../src/lib/admin/schema.ts";
import { signedRatingToken, verifyRatingToken, saveRating, ratingSummary } from "../src/lib/admin/ratings.ts";

test("rating links are edition-bound; ratings persist, update and aggregate", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ratings-"));
  process.env.BLOG_STORAGE_TURSO_DATABASE_URL = "";
  process.env.TURSO_DATABASE_URL = `file:${join(dir, "test.db")}`;
  process.env.NEWSLETTER_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  try {
    await migrateDatabase(database());
    await migrateDatabase(database());
    const token = signedRatingToken("edition", "reader@example.com");
    assert.ok(verifyRatingToken("edition", token));
    assert.equal(verifyRatingToken("another", token), null);
    assert.equal(verifyRatingToken("edition", token.slice(1)), null);
    await sql(`INSERT INTO newsletter_editions VALUES ('edition','notion','Title','<p>Hi</p>','today','admin','today'), ('draft','notion','Draft','','today','admin',NULL)`);
    assert.equal(await saveRating("missing", "a", 1), false);
    assert.equal(await saveRating("draft", "a", 1), false);
    await assert.rejects(saveRating("edition", "a", 2));
    await saveRating("edition", "a", 1);
    await saveRating("edition", "a", 5);
    await saveRating("edition", "b", 3);
    await saveRating("edition", "c", 1);
    assert.deepEqual(await ratingSummary("edition"), { total: 3, average: 3, one: 1, three: 1, five: 1 });
    assert.deepEqual(await ratingSummary("draft"), { total: 0, average: null, one: 0, three: 0, five: 0 });
  } finally { closeDatabase(); rmSync(dir, { recursive: true, force: true }); }
});
