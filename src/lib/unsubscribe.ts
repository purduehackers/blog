import {
  getMailingList,
  type NewsletterConfig,
} from "./notion-mailing-list.ts";

function reply(message: string, status = 200) {
  return Response.json(
    { message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function unsubscribe(
  request: Request,
  config: NewsletterConfig,
  notionFetch: typeof fetch = fetch,
): Promise<Response> {
  // GET requests and email preview scanners must never change subscriptions.
  if (request.method !== "POST")
    return reply("Please confirm using the unsubscribe form.", 405);
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return reply("Please use the unsubscribe form on this site.", 403);
  if (
    request.headers.get("content-type")?.split(";")[0]?.trim() !==
    "application/json"
  )
    return reply("Please submit the unsubscribe form again.", 415);
  let email: string;
  try {
    const body = await request.text();
    if (body.length > 4096) return reply("The request is too long.", 413);
    const input = JSON.parse(body);
    email =
      typeof input?.email === "string" ? input.email.trim().toLowerCase() : "";
  } catch {
    return reply("Please enter a valid email address.", 400);
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return reply("Please enter a valid email address.", 400);
  if (!config.apiKey || !config.databaseId)
    return reply(
      "Unsubscribe is temporarily unavailable. Please try again later.",
      503,
    );

  try {
    const { notion, dataSourceId, properties } = await getMailingList(
      config,
      notionFetch,
    );
    const emailKey = config.emailProperty || "Email";
    const emailType = properties[emailKey]?.type;
    if (
      (emailType !== "email" && emailType !== "rich_text") ||
      properties.Unsubscribed?.type !== "checkbox" ||
      properties["Unsubscribed At"]?.type !== "date"
    ) {
      throw new Error(
        "Check the Email, Unsubscribed (checkbox), and Unsubscribed At (date) columns.",
      );
    }
    // Fetch all matches before patching so pagination is stable for duplicate rows.
    const pageIds: string[] = [];
    let cursor: string | null = null;
    do {
      const result: {
        results: { id: string }[];
        has_more: boolean;
        next_cursor: string | null;
      } = await notion(
        `data_sources/${encodeURIComponent(dataSourceId)}/query`,
        {
          filter: {
            and: [
              { property: emailKey, [emailType]: { equals: email } },
              { property: "Unsubscribed", checkbox: { equals: false } },
            ],
          },
          page_size: 100,
          ...(cursor ? { start_cursor: cursor } : {}),
        },
      );
      pageIds.push(...result.results.map((page) => page.id));
      if (result.has_more && !result.next_cursor)
        throw new Error("Incomplete Notion query.");
      cursor = result.has_more ? result.next_cursor : null;
    } while (cursor);
    const unsubscribedAt = new Date().toISOString();
    for (const id of pageIds) {
      await notion(
        `pages/${encodeURIComponent(id)}`,
        {
          properties: {
            Unsubscribed: { checkbox: true },
            "Unsubscribed At": { date: { start: unsubscribedAt } },
          },
        },
        "PATCH",
      );
    }
    // Same result for unknown and already-unsubscribed addresses.
    return reply(
      "You've been unsubscribed from the Purdue Hackers newsletter.",
    );
  } catch (error) {
    console.error(
      "Newsletter unsubscribe failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return reply(
      "We couldn't save your unsubscribe request. Please try again in a moment.",
      502,
    );
  }
}
