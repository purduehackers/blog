import { createHmac, timingSafeEqual } from "node:crypto";
import { required } from "./config.ts";
import { sql } from "./database.ts";

export function ratingToken(id: string, email: string): string {
  return createHmac("sha256", required("NEWSLETTER_ENCRYPTION_KEY"))
    .update(`newsletter-rating:${id}:${email.trim().toLowerCase()}`).digest("hex");
}
export function signedRatingToken(id: string, email: string): string {
  const token = ratingToken(id, email);
  const signature = createHmac("sha256", required("NEWSLETTER_ENCRYPTION_KEY"))
    .update(`rating-link:${id}:${token}`).digest("hex");
  return `${token}.${signature}`;
}
export function verifyRatingToken(id: string, value: string): string | null {
  if (!/^[a-f\d]{64}\.[a-f\d]{64}$/.test(value)) return null;
  const [token, signature] = value.split(".") as [string, string];
  const expected = createHmac("sha256", required("NEWSLETTER_ENCRYPTION_KEY"))
    .update(`rating-link:${id}:${token}`).digest("hex");
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected)) ? token : null;
}
export async function saveRating(id: string, voter: string, score: number): Promise<boolean> {
  if (![1, 3, 5].includes(score)) throw new Error("Choose 1, 3, or 5 flames.");
  const result = await sql({
    sql: `INSERT INTO newsletter_ratings(edition_id,voter,score,updated_at)
      SELECT id,?,?,strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM newsletter_editions
      WHERE id=? AND published_at IS NOT NULL
      ON CONFLICT(edition_id,voter) DO UPDATE SET score=excluded.score,updated_at=excluded.updated_at`,
    args: [voter, score, id],
  });
  return result.rowsAffected === 1;
}
export async function ratingSummary(id: string) {
  const result = await sql({
    sql: `SELECT COUNT(*) AS total, AVG(score) AS average,
      COALESCE(SUM(score=1),0) AS one, COALESCE(SUM(score=3),0) AS three,
      COALESCE(SUM(score=5),0) AS five FROM newsletter_ratings WHERE edition_id=?`,
    args: [id],
  });
  const row = result.rows[0]!;
  return { total: Number(row.total), average: row.average === null ? null : Number(row.average),
    one: Number(row.one), three: Number(row.three), five: Number(row.five) };
}
