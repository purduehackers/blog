import { trackedLinks } from "./clicks.ts";
import { signedRatingToken } from "./ratings.ts";
import sharp from "sharp";
import {
  locked,
  getMedia,
  getEdition,
  insertEdition,
  deleteEdition,
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
import { DeliveryError, graphAccessToken, sendEmail, type InlineImage } from "./microsoft.ts";
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
export async function deleteNewsletter(id: string): Promise<void> {
  await locked(`edition:${id}`, async () => {
    await campaign(id);
    await deleteEdition(id);
  });
}
export function messageHtml(page: ImportedPage, email: string): string {
  const url = `${siteOrigin()}/posts/${page.id}`;
  const unsubscribe = `${siteOrigin()}/unsubscribe?email=${encodeURIComponent(email)}`;
  const ratingLinks = [1, 3, 5].map((score) =>
    `<div style="margin:8px 0"><a href="${escapeHtml(`${siteOrigin()}/rate?edition=${page.id}&score=${score}&token=${signedRatingToken(page.id, email)}`)}" style="text-decoration:underline">${"🔥".repeat(score)} ${(score === 1 ? "Meh" : score === 3 ? "Solid issue" : "This was gold!")}</a></div>`
  ).join(" ");
  return emailDocument(
    { ...page, html: trackedLinks(page.html, page.id, "email") },
    `<hr style="margin-top:32px"><p>How was this newsletter?</p><div style="margin:16px 0">${ratingLinks}</div><p style="font-size:13px">Click a flame rating to rate this edition.</p><p style="font-size:13px;line-height:1.6">You subscribed to the Purdue Hackers newsletter.<br><a href="${escapeHtml(url)}">Read on the website</a> · <a href="${escapeHtml(unsubscribe)}">Unsubscribe</a></p>`,
  );
}
// Read stored bytes rather than asking the recipient to reach the import host
// (which may be localhost or a protected preview deployment).
export async function emailContent(page: ImportedPage, email: string) {
  let html = messageHtml(page, email);
  const attachments: InlineImage[] = [];
  const urls = [...html.matchAll(/<img\b[^>]*\bsrc="([^"]*\/api\/newsletter-media\/([a-f\d-]+))"/g)];
  const included = new Set<string>();
  for (const [, url, id] of urls) {
    if (!id || !url || !validId(id)) throw new Error("Invalid newsletter photo ID.");
    if (!included.has(id)) {
      const media = await getMedia(id);
      if (!media || media.campaignId !== page.id)
        throw new Error("A newsletter photo is missing. Import the edition again.");
      attachments.push({
        "@odata.type": "#microsoft.graph.fileAttachment",
        name: `photo-${id}.${media.type.split("/")[1]}`,
        contentType: media.type,
        contentBytes: media.body,
        contentId: `photo-${id}`,
        isInline: true,
      });
      included.add(id);
    }
    html = html.replaceAll(`src="${url}"`, `src="cid:photo-${id}"`);
  }
  // Keep the JSON request below Graph's single-request limit. Optimize only
  // email copies; the website keeps the original stored photos.
  const payloadBytes = () => Buffer.byteLength(JSON.stringify({ html, attachments }));
  for (const width of [1000, 800, 600]) {
    if (payloadBytes() <= 3000000) break;
    for (const attachment of attachments) {
      if (attachment.contentType === "image/gif") continue;
      const original = Buffer.from(attachment.contentBytes, "base64");
      const source = sharp(original);
      const metadata = await source.metadata();
      const resized = source.rotate().resize({
        width, height: width * 2, fit: "inside", withoutEnlargement: true,
      });
      const body = await (metadata.hasAlpha
        ? resized.png({ palette: true, quality: 65 })
        : resized.jpeg({ quality: width === 600 ? 60 : 72 })
      ).toBuffer();
      if (body.length >= original.length) continue;
      attachment.contentType = metadata.hasAlpha ? "image/png" : "image/jpeg";
      attachment.name = `photo-${attachment.contentId}.${metadata.hasAlpha ? "png" : "jpg"}`;
      attachment.contentBytes = body.toString("base64");
    }
  }
  if (payloadBytes() > 3500000)
    throw new Error("Email photos are too large to send. Reduce the photos or animated GIFs and try again.");
  return { html, attachments };
}
export async function sendTest(id: string, email: string): Promise<void> {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
    throw new Error("Enter a valid test email address.");
  const page = await campaign(id);
  const content = await emailContent(page, email);
  await sendEmail(
    await graphAccessToken(),
    email,
    `[TEST] ${page.title}`,
    content.html,
    content.attachments,
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
    const content = await emailContent(page, email);
    const token = await graphAccessToken();
    if (!(await claimDelivery(id, email, at))) return;
    try {
      await sendEmail(token, email, page.title, content.html, content.attachments);
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
