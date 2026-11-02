import { key, locked, read, redis, write } from "./store.ts";
import { emailDocument, escapeHtml, type ImportedPage } from "./notion.ts";
import { DeliveryError, graphAccessToken, sendEmail } from "./microsoft.ts";
import { getRecipients } from "./recipients.ts";
import { siteOrigin } from "./config.ts";

export type DeliveryStatus =
  | "accepted"
  | "skipped"
  | "pending"
  | "failed"
  | "unknown";
export interface Delivery {
  status: DeliveryStatus;
  at: string;
  message?: string;
}
export interface Audience {
  emails: string[];
  startedAt: string;
}
export function validId(id: string): boolean {
  return /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/.test(
    id,
  );
}
export async function campaign(id: string): Promise<ImportedPage> {
  if (!validId(id)) throw new Error("Invalid edition ID.");
  const page = await read<ImportedPage>(`edition:${id}`);
  if (!page) throw new Error("Edition not found.");
  return page;
}
export async function saveDraft(page: ImportedPage): Promise<void> {
  await redis(
    "EVAL",
    "redis.call('SET',KEYS[1],ARGV[1]); redis.call('ZADD',KEYS[2],ARGV[2],ARGV[3]); return 1",
    2,
    key(`edition:${page.id}`),
    key("editions"),
    JSON.stringify(page),
    Date.parse(page.createdAt),
    page.id,
  );
}
export async function listEditions(
  publishedOnly = false,
): Promise<ImportedPage[]> {
  const ids = await redis<string[]>(
    "ZREVRANGE",
    key(publishedOnly ? "published" : "editions"),
    0,
    99,
  );
  if (!ids.length) return [];
  const values = await redis<(string | null)[]>(
    "MGET",
    ...ids.map((id) => key(`edition:${id}`)),
  );
  return values
    .filter((value): value is string => value !== null)
    .map((value) => JSON.parse(value) as ImportedPage)
    .filter((page) => !publishedOnly || !!page.publishedAt);
}
export async function publish(id: string): Promise<ImportedPage> {
  return locked(`edition:${id}`, async () => {
    const page = await campaign(id);
    if (!page.publishedAt) {
      page.publishedAt = new Date().toISOString();
      await redis(
        "EVAL",
        "redis.call('SET',KEYS[1],ARGV[1]); redis.call('ZADD',KEYS[2],ARGV[2],ARGV[3]); return 1",
        2,
        key(`edition:${id}`),
        key("published"),
        JSON.stringify(page),
        Date.parse(page.publishedAt),
        id,
      );
    }
    return page;
  });
}
export function messageHtml(page: ImportedPage, email: string): string {
  const url = `${siteOrigin()}/newsletter/${page.id}`;
  const unsubscribe = `${siteOrigin()}/unsubscribe?email=${encodeURIComponent(email)}`;
  return emailDocument(
    page,
    `<hr style="margin-top:32px"><p style="font-size:13px;line-height:1.6">You subscribed to the Purdue Hackers newsletter.<br><a href="${escapeHtml(url)}">Read on the website</a> · <a href="${escapeHtml(unsubscribe)}">Unsubscribe</a></p>`,
  );
}
export async function sendTest(id: string, email: string): Promise<void> {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
    throw new Error("Enter a valid test email address.");
  const page = await campaign(id);
  await sendEmail(
    await graphAccessToken(),
    email,
    `[TEST] ${page.title}`,
    messageHtml(page, email),
  );
}
async function deliveries(id: string): Promise<Record<string, Delivery>> {
  const data = await redis<string[]>("HGETALL", key(`delivery:${id}`));
  const result: Record<string, Delivery> = {};
  for (let i = 0; i < data.length; i += 2)
    result[data[i]!] = JSON.parse(data[i + 1]!) as Delivery;
  return result;
}
export async function progress(id: string) {
  const audience = await read<Audience>(`audience:${id}`);
  const states = await deliveries(id);
  const counts = {
    total: audience?.emails.length || 0,
    accepted: 0,
    skipped: 0,
    uncertain: 0,
    failed: 0,
    remaining: 0,
  };
  const issues: { email: string; status: string; message: string }[] = [];
  for (const email of audience?.emails || []) {
    const state = states[email];
    if (!state) counts.remaining++;
    else if (state.status === "accepted") counts.accepted++;
    else if (state.status === "skipped") counts.skipped++;
    else {
      if (state.status === "failed") counts.failed++;
      else counts.uncertain++;
      issues.push({
        email,
        status: state.status,
        message:
          state.message ||
          "No send confirmation was saved. Review Microsoft Sent Items before retrying.",
      });
    }
  }
  return { ...counts, started: !!audience, issues };
}
export async function startDelivery(id: string): Promise<void> {
  await locked(`edition:${id}`, async () => {
    const page = await campaign(id);
    if (!page.publishedAt)
      throw new Error("Publish the edition before sending it.");
    if (await read<Audience>(`audience:${id}`)) return;
    await graphAccessToken(); // Do not freeze the audience if the sender is not connected.
    const emails = await getRecipients();
    await write(`audience:${id}`, {
      emails,
      startedAt: new Date().toISOString(),
    } satisfies Audience);
  });
}
// One recipient per request keeps work inside the serverless deadline. The browser
// continues while open; after a closed tab the durable cursor resumes on demand.
export async function sendNext(id: string): Promise<void> {
  await locked(`edition:${id}`, async () => {
    const page = await campaign(id);
    const audience = await read<Audience>(`audience:${id}`);
    if (!audience || !page.publishedAt)
      throw new Error("Start delivery from a published edition first.");
    const states = await deliveries(id);
    // Unconfirmed or rejected mail needs a human decision before continuing.
    if (
      Object.values(states).some(
        (s) => !["accepted", "skipped"].includes(s.status),
      )
    )
      return;
    const email = audience.emails.find((item) => !states[item]);
    if (!email) return;
    const deliveryKey = key(`delivery:${id}`);
    const at = new Date().toISOString();
    // Recheck current subscriptions immediately before each email. All failures
    // occur before claiming/sending, so unavailable Notion never sends mail.
    if (!(await getRecipients(email)).includes(email)) {
      await redis(
        "HSET",
        deliveryKey,
        email,
        JSON.stringify({ status: "skipped", at } satisfies Delivery),
      );
      return;
    }
    const token = await graphAccessToken();
    if (
      (await redis<number>(
        "HSETNX",
        deliveryKey,
        email,
        JSON.stringify({ status: "pending", at } satisfies Delivery),
      )) !== 1
    )
      return;
    try {
      await sendEmail(token, email, page.title, messageHtml(page, email));
    } catch (error) {
      const state: Delivery = {
        status:
          error instanceof DeliveryError && !error.uncertain
            ? "failed"
            : "unknown",
        at,
        message:
          error instanceof Error
            ? error.message
            : "Delivery could not be confirmed.",
      };
      await redis("HSET", deliveryKey, email, JSON.stringify(state));
      return;
    }
    // If this persistence fails, 'pending' survives and automatic retries stop.
    await redis(
      "HSET",
      deliveryKey,
      email,
      JSON.stringify({ status: "accepted", at } satisfies Delivery),
    );
  });
}
export async function resolveDelivery(
  id: string,
  email: string,
  action: string,
): Promise<void> {
  await locked(`edition:${id}`, async () => {
    await campaign(id);
    const states = await deliveries(id);
    const state = states[email];
    if (!state || ["accepted", "skipped"].includes(state.status))
      throw new Error("This recipient has no delivery issue.");
    if (action === "retry") await redis("HDEL", key(`delivery:${id}`), email);
    else if (action === "skip")
      await redis(
        "HSET",
        key(`delivery:${id}`),
        email,
        JSON.stringify({
          status: "skipped",
          at: new Date().toISOString(),
          message: "Reviewed by an organizer; no further send.",
        } satisfies Delivery),
      );
    else throw new Error("Choose retry or skip after reviewing Sent Items.");
  });
}
