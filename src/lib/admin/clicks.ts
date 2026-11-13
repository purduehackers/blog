import { createHmac, timingSafeEqual } from "node:crypto";
import { required, siteOrigin } from "./config.ts";
import { batch, sql } from "./database.ts";
import { escapeHtml } from "./notion.ts";

export type ClickSource = "web" | "email";
function signature(edition: string, source: string, destination: string) {
  return createHmac("sha256", required("NEWSLETTER_ENCRYPTION_KEY"))
    .update(JSON.stringify([edition, source, destination]))
    .digest("hex");
}
export function trackedLinks(
  html: string,
  edition: string,
  source: ClickSource,
): string {
  return html.replace(
    /(<a\b[^>]*\bhref\s*=\s*)(["'])(.*?)\2/gi,
    (match, prefix, quote, encoded) => {
      const destination = encoded
        .replace(/&amp;/g, "&")
        .replace(/&#39;|&apos;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&#(x[\da-f]+|\d+);/gi, (_: string, code: string) =>
          String.fromCodePoint(
            code.charAt(0).toLowerCase() === "x"
              ? parseInt(code.slice(1), 16)
              : Number(code),
          ),
        );
      if (!destination || destination.startsWith("#")) return match;
      let url: URL;
      try {
        url = new URL(destination, siteOrigin());
      } catch {
        return match;
      }
      if (
        !["https:", "http:"].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.pathname === "/api/newsletter-click"
      )
        return match;
      const target = url.href;
      const query = new URLSearchParams({
        edition,
        source,
        url: target,
        signature: signature(edition, source, target),
      });
      return `${prefix}${quote}${escapeHtml(`${siteOrigin()}/api/newsletter-click?${query}`)}${quote}`;
    },
  );
}
export function verifyClick(
  edition: string,
  source: string,
  destination: string,
  value: string,
): boolean {
  if (!["web", "email"].includes(source) || !/^[a-f\d]{64}$/.test(value))
    return false;
  try {
    const url = new URL(destination);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return false;
    return timingSafeEqual(
      Buffer.from(value),
      Buffer.from(signature(edition, source, destination)),
    );
  } catch {
    return false;
  }
}
export async function recordClick(
  edition: string,
  source: ClickSource,
  destination: string,
  visitor: string,
) {
  await sql({
    sql: `INSERT INTO newsletter_clicks(edition_id,source,destination,visitor,clicked_at)
    SELECT id,?,?,?,strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM newsletter_editions WHERE id=? AND published_at IS NOT NULL`,
    args: [source, destination, visitor, edition],
  });
}
export async function clickSummary(edition: string) {
  const results = await batch([
    {
      sql: `SELECT destination,source,COUNT(*) AS clicks,COUNT(DISTINCT visitor) AS visitors
    FROM newsletter_clicks WHERE edition_id=? GROUP BY destination,source
    UNION ALL SELECT destination,'combined',COUNT(*),COUNT(DISTINCT visitor) FROM newsletter_clicks WHERE edition_id=? GROUP BY destination`,
      args: [edition, edition],
    },
    {
      sql: `SELECT source,COUNT(*) AS clicks,COUNT(DISTINCT visitor) AS visitors FROM newsletter_clicks WHERE edition_id=? GROUP BY source
    UNION ALL SELECT 'combined',COUNT(*),COUNT(DISTINCT visitor) FROM newsletter_clicks WHERE edition_id=?`,
      args: [edition, edition],
    },
  ]);
  const [{ rows: links }, { rows: totals }] = [results[0]!, results[1]!];
  const counts = (rows: typeof links) =>
    Object.fromEntries(
      rows.map((row) => [
        String(row.source),
        { clicks: Number(row.clicks), visitors: Number(row.visitors) },
      ]),
    );
  const destinations = [
    ...new Set(links.map((row) => String(row.destination))),
  ];
  return {
    totals: counts(totals),
    links: destinations.map((url) => ({
      url,
      counts: counts(links.filter((row) => row.destination === url)),
    })),
  };
}
