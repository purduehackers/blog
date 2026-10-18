export interface NewsletterConfig {
  apiKey: string;
  databaseId: string;
  dataSourceId?: string | undefined;
  nameProperty?: string | undefined;
  emailProperty?: string | undefined;
}

interface NotionProperty {
  type: string;
}

export function getNewsletterConfig(): NewsletterConfig {
  return {
    apiKey: process.env.NOTION_API_KEY || import.meta.env.NOTION_API_KEY || "",
    databaseId:
      process.env.NOTION_DATABASE_ID ||
      import.meta.env.NOTION_DATABASE_ID ||
      "346181f3b6ed800586cfdd7c42d0ac65",
    dataSourceId:
      process.env.NOTION_DATA_SOURCE_ID ||
      import.meta.env.NOTION_DATA_SOURCE_ID,
    nameProperty:
      process.env.NOTION_NAME_PROPERTY || import.meta.env.NOTION_NAME_PROPERTY,
    emailProperty:
      process.env.NOTION_EMAIL_PROPERTY ||
      import.meta.env.NOTION_EMAIL_PROPERTY,
  };
}

export async function getMailingList(
  config: NewsletterConfig,
  notionFetch: typeof fetch = fetch,
) {
  async function notion<T>(
    path: string,
    body?: unknown,
    method = body === undefined ? "GET" : "POST",
  ): Promise<T> {
    const response = await notionFetch(`https://api.notion.com/v1/${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Notion-Version": "2025-09-03",
        "Content-Type": "application/json",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      // Never log the response body: it can contain subscriber information.
      throw new Error(`Notion request failed (${response.status})`);
    }
    return response.json() as Promise<T>;
  }

  let dataSourceId = config.dataSourceId;
  if (!dataSourceId) {
    const database = await notion<{ data_sources: { id: string }[] }>(
      `databases/${encodeURIComponent(config.databaseId)}`,
    );
    if (database.data_sources.length !== 1) {
      throw new Error(
        "Set NOTION_DATA_SOURCE_ID to select the mailing list data source.",
      );
    }
    dataSourceId = database.data_sources[0]!.id;
  }

  const source = await notion<{ properties: Record<string, NotionProperty> }>(
    `data_sources/${encodeURIComponent(dataSourceId)}`,
  );
  return { notion, dataSourceId, properties: source.properties };
}
