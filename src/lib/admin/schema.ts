import type { Client } from "@libsql/client";

const schema = [
  `CREATE TABLE IF NOT EXISTS newsletter_clicks (
    edition_id TEXT NOT NULL REFERENCES newsletter_editions(id),
    source TEXT NOT NULL CHECK(source IN ('web','email')), destination TEXT NOT NULL,
    visitor TEXT NOT NULL, clicked_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS newsletter_clicks_edition ON newsletter_clicks(edition_id,destination,source)`,

  `CREATE TABLE IF NOT EXISTS newsletter_ratings (
    edition_id TEXT NOT NULL REFERENCES newsletter_editions(id), voter TEXT NOT NULL,
    score INTEGER NOT NULL CHECK(score IN (1,3,5)), updated_at TEXT NOT NULL,
    PRIMARY KEY(edition_id,voter)
  )`,

  `CREATE TABLE IF NOT EXISTS newsletter_editions (
    id TEXT PRIMARY KEY, notion_id TEXT NOT NULL, title TEXT NOT NULL, html TEXT NOT NULL,
    created_at TEXT NOT NULL, created_by TEXT NOT NULL, published_at TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS newsletter_editions_created ON newsletter_editions(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS newsletter_editions_published ON newsletter_editions(published_at DESC) WHERE published_at IS NOT NULL`,
  `CREATE TABLE IF NOT EXISTS newsletter_media (
    id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL, content_type TEXT NOT NULL, body BLOB NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS newsletter_credentials (
    provider TEXT PRIMARY KEY, refresh_token TEXT NOT NULL, access_token TEXT NOT NULL,
    expires_at INTEGER NOT NULL, email TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS newsletter_sessions (
    id TEXT PRIMARY KEY, token TEXT NOT NULL, subject TEXT NOT NULL, expires_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS newsletter_sessions_expiry ON newsletter_sessions(expires_at)`,
  `CREATE TABLE IF NOT EXISTS newsletter_oauth_states (
    id TEXT PRIMARY KEY, verifier TEXT NOT NULL, expires_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS newsletter_oauth_expiry ON newsletter_oauth_states(expires_at)`,
  `CREATE TABLE IF NOT EXISTS newsletter_leases (
    name TEXT PRIMARY KEY, owner TEXT NOT NULL, expires_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS newsletter_audiences (
    edition_id TEXT PRIMARY KEY REFERENCES newsletter_editions(id), started_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS newsletter_recipients (
    edition_id TEXT NOT NULL REFERENCES newsletter_audiences(edition_id), email TEXT NOT NULL,
    status TEXT CHECK(status IN ('accepted','skipped','pending','failed','unknown')),
    attempted_at TEXT, message TEXT, PRIMARY KEY(edition_id, email)
  )`,
  `CREATE TABLE IF NOT EXISTS newsletter_schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)`,
  `INSERT OR IGNORE INTO newsletter_schema_migrations(version, applied_at) VALUES (1, strftime('%Y-%m-%dT%H:%M:%fZ','now'))`,
  `INSERT OR IGNORE INTO newsletter_schema_migrations(version, applied_at) VALUES (3, strftime('%Y-%m-%dT%H:%M:%fZ','now'))`,
  `INSERT OR IGNORE INTO newsletter_schema_migrations(version, applied_at) VALUES (2, strftime('%Y-%m-%dT%H:%M:%fZ','now'))`,
];

// Explicit, idempotent setup; page requests never create or modify the schema.
export async function migrateDatabase(client: Client): Promise<void> {
  await client.batch(schema, "write");
}
