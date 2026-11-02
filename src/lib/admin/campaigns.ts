import {
  locked,
  getEdition,
  insertEdition,
  getEditions,
  publishedEdition,
  getAudience,
  createAudience,
  getDeliveries,
  setDelivery,
  claimDelivery,
  resetDelivery,
} from "./store.ts";
import type { EditionSummary } from "./store.ts";
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
  const page = await getEdition(id);
  if (!page) throw new Error("Edition not found.");
  return page;
}
export async function saveDraft(page: ImportedPage): Promise<void> {
  await insertEdition(page);
}
export async function listEditions(
  publishedOnly = false,
): Promise<EditionSummary[]> {
  return getEditions(publishedOnly);
}
export async function publish(id: string): Promise<ImportedPage> {
  return locked(`edition:${id}`, async () => {
    await campaign(id);
    await publishedEdition(id);
    return campaign(id);
  });
}
export function messageHtml(page: ImportedPage, email: string): string {
  const url = `${siteOrigin()}/posts/${page.id}`;
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
export async function progress(id: string) {
  const audience = await getAudience(id);
  const states = await getDeliveries(id);
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
    if (await getAudience(id)) return;
    await graphAccessToken(); // Do not freeze the audience if the sender is not connected.
    const emails = await getRecipients();
    await createAudience(id, emails);
  });
}
// One recipient per request keeps work inside the serverless deadline. The browser
// continues while open; after a closed tab the durable cursor resumes on demand.
export async function sendNext(id: string): Promise<void> {
  await locked(`edition:${id}`, async () => {
    const page = await campaign(id);
    const audience = await getAudience(id);
    if (!audience || !page.publishedAt)
      throw new Error("Start delivery from a published edition first.");
    const states = await getDeliveries(id);
    // Unconfirmed or rejected mail needs a human decision before continuing.
    if (
      Object.values(states).some(
        (s) => !["accepted", "skipped"].includes(s.status),
      )
    )
      return;
    const email = audience.emails.find((item) => !states[item]);
    if (!email) return;
    const at = new Date().toISOString();
    // Recheck current subscriptions immediately before each email. All failures
    // occur before claiming/sending, so unavailable Notion never sends mail.
    if (!(await getRecipients(email)).includes(email)) {
      await setDelivery(id, email, { status: "skipped", at });
      return;
    }
    const token = await graphAccessToken();
    if (!(await claimDelivery(id, email, at))) return;
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
      await setDelivery(id, email, state);
      return;
    }
    // If this persistence fails, 'pending' survives and automatic retries stop.
    await setDelivery(id, email, { status: "accepted", at });
  });
}
export async function resolveDelivery(
  id: string,
  email: string,
  action: string,
): Promise<void> {
  await locked(`edition:${id}`, async () => {
    await campaign(id);
    const states = await getDeliveries(id);
    const state = states[email];
    if (!state || ["accepted", "skipped"].includes(state.status))
      throw new Error("This recipient has no delivery issue.");
    if (action === "retry") await resetDelivery(id, email);
    else if (action === "skip")
      await setDelivery(id, email, {
        status: "skipped",
        at: new Date().toISOString(),
        message: "Reviewed by an organizer; no further send.",
      });
    else throw new Error("Choose retry or skip after reviewing Sent Items.");
  });
}
