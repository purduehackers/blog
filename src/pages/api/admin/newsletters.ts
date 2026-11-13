import { clickSummary } from "../../../lib/admin/clicks";
import { ratingSummary } from "../../../lib/admin/ratings";
import type { APIRoute } from "astro";
import { AdminError } from "../../../lib/admin/auth";
import {
  campaign,
  deleteNewsletter,
  listEditions,
  progress,
  publish,
  reimportNewsletter,
  renameNewsletter,
  resolveDelivery,
  saveDraft,
  sendNext,
  sendTest,
  startDelivery,
  validId,
} from "../../../lib/admin/campaigns";
import { importNotionPage } from "../../../lib/admin/notion";
import { sender } from "../../../lib/admin/config";
import { getMicrosoftCredential } from "../../../lib/admin/store";

export const prerender = false;
function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, no-store",
    },
  });
}
export const GET: APIRoute = async ({ locals }) => {
  if (!locals.admin) throw new AdminError("Sign in to continue.", 401);
  const [savedEditions, credential] = await Promise.all([
    listEditions(),
    getMicrosoftCredential(),
  ]);
  const editions = savedEditions.map(
    ({ createdBy: _createdBy, ...page }) => page,
  );
  return json({
    editions,
    sender: sender(),
    connected: credential?.email === sender(),
  });
};
export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.admin) throw new AdminError("Sign in to continue.", 401);
  try {
    if (
      request.headers.get("content-type")?.split(";")[0] !== "application/json"
    )
      return json({ message: "Submit JSON from the admin page." }, 415);
    const text = await request.text();
    if (text.length > 4096) return json({ message: "Request too large." }, 413);
    const input = JSON.parse(text) as Record<string, unknown>;
    if (!input || Array.isArray(input) || typeof input !== "object")
      return json({ message: "Invalid request." }, 400);
    const field = (name: string) =>
      typeof input[name] === "string" ? (input[name] as string) : "";
    const action = field("action");
    let id = field("id");
    if (action === "preview") return json({ page: await campaign(id) });
    if (action === "import") {
      const title = field("title").trim();
      const page = await importNotionPage(
        field("url"),
        locals.admin.sub,
        "newsletter",
        title ? { title } : {},
      );
      await saveDraft(page);
      id = page.id;
    } else {
      if (!validId(id)) throw new Error("Invalid edition ID.");
      if (action === "delete") {
        if (field("confirmation") !== "DELETE")
          return json({ message: "Confirm newsletter deletion." }, 400);
        await deleteNewsletter(id);
        return json({ deletedId: id, message: "Newsletter deleted." });
      }
      if (action === "publish") await publish(id);
      else if (action === "rename") await renameNewsletter(id, field("title"));
      else if (action === "reimport") await reimportNewsletter(id);
      else if (action === "test")
        await sendTest(id, field("email").trim().toLowerCase());
      else if (action === "start") {
        if (field("confirmation") !== "SEND")
          return json(
            { message: "Type SEND to confirm newsletter delivery." },
            400,
          );
        await startDelivery(id);
      } else if (action === "next") await sendNext(id);
      else if (action === "resolve") {
        if (field("confirmation") !== "REVIEWED")
          return json(
            { message: "Review Sent Items before resolving this recipient." },
            400,
          );
        await resolveDelivery(id, field("email"), field("resolution"));
      } else if (action !== "load" && action !== "stats")
        return json({ message: "Unknown action." }, 400);
    }
    const [page, delivery, ratings, clicks] = await Promise.all([
      action === "stats" ? undefined : campaign(id),
      progress(id),
      ratingSummary(id),
      clickSummary(id),
    ]);
    return json({
      page,
      progress: delivery,
      ratings,
      clicks,
      message:
        action === "test"
          ? "Microsoft accepted the test email. Check your inbox."
          : action === "rename"
            ? "Newsletter name saved."
            : action === "reimport"
              ? "Newsletter updated from Notion."
              : undefined,
    });
  } catch (error) {
    // Our integrations throw controlled messages without response bodies/tokens.
    return json(
      {
        message:
          error instanceof SyntaxError
            ? "Invalid request."
            : error instanceof Error
              ? error.message
              : "The operation failed. Try again.",
      },
      400,
    );
  }
};
