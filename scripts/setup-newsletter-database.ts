import { database, closeDatabase } from "../src/lib/admin/database.ts";
import { migrateDatabase } from "../src/lib/admin/schema.ts";

try {
  await migrateDatabase(database());
  console.log(
    "Newsletter SQLite schema is ready. Existing data was preserved.",
  );
} catch {
  console.error(
    "Database setup failed. Check BLOG_STORAGE_TURSO_DATABASE_URL / BLOG_STORAGE_TURSO_AUTH_TOKEN (or the unprefixed Turso variables) and database write access.",
  );
  process.exitCode = 1;
} finally {
  closeDatabase();
}
