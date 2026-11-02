import type { APIRoute } from "astro";
import { AdminError } from "../../../lib/admin/auth";
import {
  campaign,
  listEditions,
  progress,
  publish,
  resolveDelivery,
  saveDraft,
  sendNext,
  sendTest,
  startDelivery,
} from "../../../lib/admin/campaigns";
import { importNotionPage } from "../../../lib/admin/notion";
import { sender } from "../../../lib/admin/config";
import { read } from "../../../lib/admin/store";
import type { MicrosoftCredential } from "../../../lib/admin/microsoft";

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
  const editions = (await listEditions()).map(
    ({ html: _html, createdBy: _createdBy, ...page }) => page,
  );
  const credential = await read<MicrosoftCredential>("microsoft");
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
    if (action === "import") {
      const page = await importNotionPage(field("url"), locals.admin.sub);
      await saveDraft(page);
      id = page.id;
    } else {
      await campaign(id);
      if (action === "publish") await publish(id);
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
      } else if (action !== "load")
        return json({ message: "Unknown action." }, 400);
    }
    return json({
      page: await campaign(id),
      progress: await progress(id),
      message:
        action === "test"
          ? "Microsoft accepted the test email. Check your inbox."
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
