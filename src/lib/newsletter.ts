import {
  getMailingList,
  type NewsletterConfig,
} from "./notion-mailing-list.ts";

const successMessage = "You're on the list! Look out for our next newsletter.";

function reply(message: string, status = 200) {
  return new Response(JSON.stringify({ message }), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

// Kept separate from the route so validation and Notion failures can be tested
// without a real integration or writing test subscribers to the mailing list.
export async function subscribe(
  request: Request,
  config: NewsletterConfig,
  notionFetch: typeof fetch = fetch,
): Promise<Response> {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return reply("Please subscribe using the form on this site.", 403);
  }
  if (
    request.headers.get("content-type")?.split(";")[0]?.trim() !==
    "application/json"
  ) {
    return reply("Please submit the signup form again.", 415);
  }

  let input: Record<string, unknown>;
  try {
    const body = await request.text();
    if (body.length > 4096) return reply("The signup is too long.", 413);
    const parsed: unknown = JSON.parse(body);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return reply("Please enter your name and email.", 400);
    }
    input = parsed as Record<string, unknown>;
  } catch {
    return reply("Please enter your name and email.", 400);
  }

  // A hidden field catches simple automated submissions.
  if (input.website) return reply(successMessage);

  const name = typeof input.name === "string" ? input.name.trim() : "";
  const email =
    typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  if (!name || name.length > 100 || /[\u0000-\u001f\u007f]/.test(name)) {
    return reply("Please enter your name (up to 100 characters).", 400);
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return reply("Please enter a valid email address.", 400);
  }
  if (!config.apiKey || !config.databaseId) {
    return reply(
      "Newsletter signup is temporarily unavailable. Please try again later.",
      503,
    );
  }

  try {
    const { notion, dataSourceId, properties } = await getMailingList(
      config,
      notionFetch,
    );
    const nameKey = config.nameProperty || "Name";
    const emailKey = config.emailProperty || "Email";
    const nameType = properties[nameKey]?.type;
    const emailType = properties[emailKey]?.type;
    if (
      nameKey === emailKey ||
      (nameType !== "title" && nameType !== "rich_text") ||
      (emailType !== "email" && emailType !== "rich_text")
    ) {
      throw new Error(
        "Check NOTION_NAME_PROPERTY and NOTION_EMAIL_PROPERTY and their column types.",
      );
    }

    const existing = await notion<{ results: unknown[] }>(
      `data_sources/${encodeURIComponent(dataSourceId)}/query`,
      {
        filter: { property: emailKey, [emailType]: { equals: email } },
        page_size: 1,
      },
    );
    // Return the same message for existing addresses without changing their data.
    if (existing.results.length > 0) return reply(successMessage);

    await notion("pages", {
      parent: { type: "data_source_id", data_source_id: dataSourceId },
      properties: {
        [nameKey]: { [nameType]: [{ type: "text", text: { content: name } }] },
        [emailKey]:
          emailType === "email"
            ? { email }
            : { rich_text: [{ type: "text", text: { content: email } }] },
      },
    });
    return reply(successMessage);
  } catch (error) {
    console.error(
      "Newsletter signup failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return reply(
      "We couldn't save your signup. Please try again in a moment.",
      502,
    );
  }
}
