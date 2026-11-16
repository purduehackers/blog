import { getMailingList, getNewsletterConfig } from "../notion-mailing-list.ts";
interface Row {
  properties: Record<
    string,
    {
      email?: string;
      rich_text?: { plain_text?: string; text?: { content: string } }[];
      checkbox?: boolean;
    }
  >;
}
export function activeEmails(rows: Row[], emailProperty = "Email"): string[] {
  const active = new Set<string>();
  const suppressed = new Set<string>();
  for (const row of rows) {
    const prop = row.properties[emailProperty];
    const email = (
      prop?.email ||
      prop?.rich_text
        ?.map((r) => r.plain_text || r.text?.content || "")
        .join("") ||
      ""
    )
      .trim()
      .toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
      continue;
    // Suppress duplicates if ANY matching row is unsubscribed or lacks the flag.
    if (row.properties["Unsubscribed"]?.checkbox !== false)
      suppressed.add(email);
    else active.add(email);
  }
  return [...active].filter((email) => !suppressed.has(email)).sort();
}
export async function getRecipients(onlyEmail?: string): Promise<string[]> {
  const config = getNewsletterConfig();
  const { notion, dataSourceId, properties } = await getMailingList(config);
  const emailKey = config.emailProperty || "Email";
  const emailType = properties[emailKey]?.type;
  if (
    !["email", "rich_text"].includes(emailType || "") ||
    properties["Unsubscribed"]?.type !== "checkbox"
  ) {
    throw new Error(
      "The mailing list must have an email column and an Unsubscribed checkbox.",
    );
  }
  const rows: Row[] = [];
  let cursor: string | null = null;
  const started = Date.now();
  do {
    const result: {
      results: Row[];
      has_more: boolean;
      next_cursor: string | null;
    } = await notion(`data_sources/${encodeURIComponent(dataSourceId)}/query`, {
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
      ...(onlyEmail
        ? {
            filter: { property: emailKey, [emailType!]: { equals: onlyEmail } },
          }
        : {}),
    });
    rows.push(...result.results);
    cursor = result.has_more ? result.next_cursor : null;
    if (rows.length > 10000 || Date.now() - started > 25000)
      throw new Error("Mailing list is too large to read in one request.");
  } while (cursor);
  return activeEmails(rows, emailKey);
}
