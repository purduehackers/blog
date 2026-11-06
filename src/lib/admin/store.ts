import {
  randomBytes,
  createHash,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
import { required } from "./config.ts";
import { batch, sql } from "./database.ts";
import type { Row, InStatement } from "@libsql/client";
import type { ImportedPage, StoredMedia } from "./notion.ts";
import type { Audience, Delivery } from "./campaigns.ts";

export function opaque(): string {
  return randomBytes(32).toString("base64url");
}
export function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
function encryptionKey(): Buffer {
  const value = Buffer.from(required("NEWSLETTER_ENCRYPTION_KEY"), "base64");
  if (value.length !== 32)
    throw new Error(
      "NEWSLETTER_ENCRYPTION_KEY must be 32 random bytes encoded as base64.",
    );
  return value;
}
export function encrypt(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const body = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
}
export function decrypt(value: string): string {
  const bytes = Buffer.from(value, "base64");
  const cipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    bytes.subarray(0, 12),
  );
  cipher.setAuthTag(bytes.subarray(12, 28));
  return Buffer.concat([
    cipher.update(bytes.subarray(28)),
    cipher.final(),
  ]).toString("utf8");
}
// A lease is acquired in one atomic statement, using the database clock.
// It outlives Vercel's 60-second function deadline and is released by its owner.
export async function locked<T>(
  name: string,
  action: () => Promise<T>,
): Promise<T> {
  const owner = opaque();
  const acquired = await sql({
    sql: `INSERT INTO newsletter_leases(name, owner, expires_at)
      VALUES (?, ?, unixepoch('now') * 1000 + 120000)
      ON CONFLICT(name) DO UPDATE SET owner=excluded.owner, expires_at=excluded.expires_at
      WHERE newsletter_leases.expires_at <= unixepoch('now') * 1000 RETURNING owner`,
    args: [name, owner],
  });
  if (!acquired.rows.length)
    throw new Error("Another operation is running. Try again in two minutes.");
  try {
    return await action();
  } finally {
    await sql({
      sql: "DELETE FROM newsletter_leases WHERE name=? AND owner=?",
      args: [name, owner],
    });
  }
}

export interface Session {
  token: string;
  sub: string;
  expires: number;
}
export async function getSession(id: string): Promise<Session | null> {
  const result = await sql({
    sql: "SELECT token, subject, expires_at FROM newsletter_sessions WHERE id=? AND expires_at>?",
    args: [id, Date.now()],
  });
  const row = result.rows[0];
  return row
    ? {
        token: String(row.token),
        sub: String(row.subject),
        expires: Number(row.expires_at),
      }
    : null;
}
export async function saveSession(id: string, session: Session): Promise<void> {
  await batch(
    [
      {
        sql: "DELETE FROM newsletter_sessions WHERE expires_at<=?",
        args: [Date.now()],
      },
      {
        sql: "INSERT INTO newsletter_sessions(id,token,subject,expires_at) VALUES (?,?,?,?)",
        args: [id, session.token, session.sub, session.expires],
      },
    ],
    "write",
  );
}
export async function deleteSession(id: string): Promise<void> {
  await sql({ sql: "DELETE FROM newsletter_sessions WHERE id=?", args: [id] });
}
export async function saveOAuthState(
  id: string,
  verifier: string,
): Promise<void> {
  await batch(
    [
      {
        sql: "DELETE FROM newsletter_oauth_states WHERE expires_at<=?",
        args: [Date.now()],
      },
      {
        sql: "INSERT INTO newsletter_oauth_states(id,verifier,expires_at) VALUES (?,?,?)",
        args: [id, verifier, Date.now() + 600000],
      },
    ],
    "write",
  );
}
export async function consumeOAuthState(id: string): Promise<string | null> {
  const result = await sql({
    sql: "DELETE FROM newsletter_oauth_states WHERE id=? AND expires_at>? RETURNING verifier",
    args: [id, Date.now()],
  });
  return result.rows[0] ? String(result.rows[0].verifier) : null;
}
export interface MicrosoftCredential {
  refresh: string;
  access: string;
  expires: number;
  email: string;
}
export async function getMicrosoftCredential(): Promise<MicrosoftCredential | null> {
  const result = await sql(
    "SELECT refresh_token,access_token,expires_at,email FROM newsletter_credentials WHERE provider='microsoft'",
  );
  const row = result.rows[0];
  return row
    ? {
        refresh: String(row.refresh_token),
        access: String(row.access_token),
        expires: Number(row.expires_at),
        email: String(row.email),
      }
    : null;
}
export async function saveMicrosoftCredential(
  value: MicrosoftCredential,
): Promise<void> {
  await sql({
    sql: `INSERT INTO newsletter_credentials(provider,refresh_token,access_token,expires_at,email) VALUES ('microsoft',?,?,?,?)
    ON CONFLICT(provider) DO UPDATE SET refresh_token=excluded.refresh_token, access_token=excluded.access_token, expires_at=excluded.expires_at, email=excluded.email`,
    args: [value.refresh, value.access, value.expires, value.email],
  });
}
export type EditionSummary = Omit<ImportedPage, "html">;
function editionSummary(row: Row): EditionSummary {
  return {
    id: String(row.id),
    notionId: String(row.notion_id),
    title: String(row.title),
    createdAt: String(row.created_at),
    createdBy: String(row.created_by),
    ...(row.published_at ? { publishedAt: String(row.published_at) } : {}),
  };
}
export async function getEdition(id: string): Promise<ImportedPage | null> {
  const result = await sql({
    sql: "SELECT * FROM newsletter_editions WHERE id=?",
    args: [id],
  });
  return result.rows[0]
    ? { ...editionSummary(result.rows[0]), html: String(result.rows[0].html) }
    : null;
}
export async function insertEdition(page: ImportedPage): Promise<void> {
  await sql({
    sql: "INSERT INTO newsletter_editions(id,notion_id,title,html,created_at,created_by,published_at) VALUES (?,?,?,?,?,?,NULL)",
    args: [
      page.id,
      page.notionId,
      page.title,
      page.html,
      page.createdAt,
      page.createdBy,
    ],
  });
}
export async function deleteEdition(id: string): Promise<void> {
  await batch(
    [
      ...["newsletter_recipients", "newsletter_audiences", "newsletter_clicks", "newsletter_ratings"].map((table) => ({
        sql: `DELETE FROM ${table} WHERE edition_id=?`,
        args: [id],
      })),
      { sql: "DELETE FROM newsletter_media WHERE campaign_id=?", args: [id] },
      { sql: "DELETE FROM newsletter_editions WHERE id=?", args: [id] },
    ],
    "write",
  );
}
export async function publishedEdition(id: string): Promise<void> {
  await sql({
    sql: "UPDATE newsletter_editions SET published_at=COALESCE(published_at,?) WHERE id=?",
    args: [new Date().toISOString(), id],
  });
}
export async function getEditions(
  publishedOnly: boolean,
): Promise<EditionSummary[]> {
  const result = await sql(
    publishedOnly
      ? "SELECT id,notion_id,title,created_at,created_by,published_at FROM newsletter_editions WHERE published_at IS NOT NULL ORDER BY published_at DESC,id LIMIT 100"
      : "SELECT id,notion_id,title,created_at,created_by,published_at FROM newsletter_editions ORDER BY created_at DESC,id LIMIT 100",
  );
  return result.rows.map(editionSummary);
}
export async function saveMedia(id: string, media: StoredMedia): Promise<void> {
  await sql({
    sql: "INSERT INTO newsletter_media(id,campaign_id,content_type,body) VALUES (?,?,?,?)",
    args: [id, media.campaignId, media.type, Buffer.from(media.body, "base64")],
  });
}
export async function getMedia(id: string): Promise<StoredMedia | null> {
  const result = await sql({
    sql: "SELECT campaign_id,content_type,body FROM newsletter_media WHERE id=?",
    args: [id],
  });
  const row = result.rows[0];
  if (!row) return null;
  return {
    campaignId: String(row.campaign_id),
    type: String(row.content_type),
    body: Buffer.from(row.body as ArrayBuffer).toString("base64"),
  };
}
export async function getAudience(id: string): Promise<Audience | null> {
  const result = await batch(
    [
      {
        sql: "SELECT started_at FROM newsletter_audiences WHERE edition_id=?",
        args: [id],
      },
      {
        sql: "SELECT email FROM newsletter_recipients WHERE edition_id=? ORDER BY email",
        args: [id],
      },
    ],
    "write",
  );
  if (!result[0]!.rows.length) return null;
  return {
    startedAt: String(result[0]!.rows[0]!.started_at),
    emails: result[1]!.rows.map((row) => String(row.email)),
  };
}
export async function createAudience(
  id: string,
  emails: string[],
): Promise<void> {
  // Both the audience and all recipients commit together, even for an empty list.
  // A duplicate start fails the insert; it cannot append new recipients.
  const statements: InStatement[] = [
    {
      sql: "INSERT INTO newsletter_audiences(edition_id,started_at) VALUES (?,?)",
      args: [id, new Date().toISOString()],
    },
  ];
  for (let i = 0; i < emails.length; i += 200) {
    const group = emails.slice(i, i + 200);
    statements.push({
      sql: `INSERT INTO newsletter_recipients(edition_id,email) VALUES ${group.map(() => "(?,?)").join(",")}`,
      args: group.flatMap((email) => [id, email]),
    });
  }
  await batch(statements, "write");
}
export async function getDeliveries(
  id: string,
): Promise<Record<string, Delivery>> {
  const result = await sql({
    sql: "SELECT email,status,attempted_at,message FROM newsletter_recipients WHERE edition_id=? AND status IS NOT NULL",
    args: [id],
  });
  return Object.fromEntries(
    result.rows.map((row) => [
      String(row.email),
      {
        status: String(row.status) as Delivery["status"],
        at: String(row.attempted_at),
        ...(row.message ? { message: String(row.message) } : {}),
      },
    ]),
  );
}
export async function setDelivery(
  id: string,
  email: string,
  delivery: Delivery,
): Promise<void> {
  const result = await sql({
    sql: "UPDATE newsletter_recipients SET status=?, attempted_at=?, message=? WHERE edition_id=? AND email=?",
    args: [delivery.status, delivery.at, delivery.message || null, id, email],
  });
  if (result.rowsAffected !== 1)
    throw new Error("Recipient is not part of this edition's audience.");
}
export async function claimDelivery(
  id: string,
  email: string,
  at: string,
): Promise<boolean> {
  const result = await sql({
    sql: "UPDATE newsletter_recipients SET status='pending',attempted_at=?,message=NULL WHERE edition_id=? AND email=? AND status IS NULL RETURNING email",
    args: [at, id, email],
  });
  return result.rows.length === 1;
}
export async function resetDelivery(id: string, email: string): Promise<void> {
  await sql({
    sql: "UPDATE newsletter_recipients SET status=NULL,attempted_at=NULL,message=NULL WHERE edition_id=? AND email=? AND status IN ('failed','unknown','pending')",
    args: [id, email],
  });
}
