import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { imageLayout } from "./image-layout.ts";
import { getNewsletterConfig } from "../notion-mailing-list.ts";
import { siteOrigin } from "./config.ts";
import { saveMedia } from "./store.ts";

export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
}
export function safeUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return ["https:", "mailto:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
export function notionPageId(value: string): string {
  let path = value.trim();
  if (/^https?:/.test(path)) {
    const url = new URL(path);
    if (
      url.protocol !== "https:" ||
      ![
        "notion.so",
        "www.notion.so",
        "notion.com",
        "www.notion.com",
        "app.notion.com",
      ].includes(url.hostname)
    ) {
      throw new Error("Use a Notion page link or page ID.");
    }
    path = url.pathname.replace(/\/$/, "").split("/").pop() || "";
  }
  const match = path.match(
    /([a-f\d]{32}|[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12})$/i,
  );
  if (!match) throw new Error("The Notion link must contain a page ID.");
  return match[1]!.replace(/-/g, "").toLowerCase();
}
interface RichText {
  equation?: { expression: string };
  plain_text?: string;
  text?: { content: string; link?: { url: string } | null };
  href?: string | null;
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
    code?: boolean;
  };
}
export function richText(items: RichText[] = []): string {
  return items
    .map((item) => {
      let text = escapeHtml(
        item.plain_text ??
          item.text?.content ??
          item.equation?.expression ??
          "",
      ).replace(/\n/g, "<br>");
      const a = item.annotations;
      if (a?.code) text = `<code>${text}</code>`;
      if (a?.bold) text = `<strong>${text}</strong>`;
      if (a?.italic) text = `<em>${text}</em>`;
      if (a?.strikethrough) text = `<s>${text}</s>`;
      if (a?.underline) text = `<u>${text}</u>`;
      const href = safeUrl(item.href || item.text?.link?.url);
      return href
        ? `<a href="${escapeHtml(href)}" style="color:#6b21a8;text-decoration:underline">${text}</a>`
        : text;
    })
    .join("");
}
interface BlockData {
  expression?: string;
  rich_text?: RichText[];
  caption?: RichText[];
  cells?: RichText[][];
  url?: string;
  title?: string;
  checked?: boolean;
  type?: string;
  file?: { url: string };
  external?: { url: string };
}
interface Block {
  id: string;
  type: string;
  has_children: boolean;
  [key: string]: unknown;
}
export interface ImportedPage {
  id: string;
  notionId: string;
  title: string;
  html: string;
  createdAt: string;
  createdBy: string;
  publishedAt?: string;
}
export interface StoredMedia {
  type: string;
  body: string;
  campaignId: string;
}

export async function importNotionPage(
  input: string,
  createdBy: string,
): Promise<ImportedPage> {
  const notionId = notionPageId(input);
  const config = getNewsletterConfig();
  if (!config.apiKey)
    throw new Error(
      "Configure NOTION_API_KEY and connect the edition page to the integration.",
    );
  const started = Date.now();
  const deadline = AbortSignal.timeout(40000);
  let calls = 0;
  async function notion<T>(path: string): Promise<T> {
    if (++calls > 60 || Date.now() - started > 35000)
      throw new Error("This page is too large to import in one request.");
    const response = await fetch(`https://api.notion.com/v1/${path}`, {
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Notion-Version": "2025-09-03",
      },
      signal: AbortSignal.any([deadline, AbortSignal.timeout(8000)]),
    });
    if (response.status === 404) {
      throw new Error(
        "Notion cannot access this edition. In Notion, open the edition page → ••• → Connections and add the same integration used by the mailing list, then retry.",
      );
    }
    if (response.status === 403) {
      throw new Error(
        "The Notion integration needs Read content permission and a connection to this edition page.",
      );
    }
    if (!response.ok)
      throw new Error(
        `Notion could not read the page (${response.status}). Check its integration connection.`,
      );
    return response.json() as Promise<T>;
  }
  const page = await notion<{
    properties: Record<string, { type: string; title?: RichText[] }>;
    archived?: boolean;
    in_trash?: boolean;
  }>(`pages/${notionId}`);
  if (page.archived || page.in_trash)
    throw new Error("This Notion page is archived.");
  const title = Object.values(page.properties)
    .find((p) => p.type === "title")
    ?.title?.map((r) => r.plain_text ?? r.text?.content ?? "")
    .join("")
    .trim();
  if (!title || title.length > 200)
    throw new Error("Give the Notion page a title of 1–200 characters.");
  const id = randomUUID();
  let blockCount = 0;
  let imageBytes = 0;
  async function image(data: BlockData): Promise<string> {
    if (deadline.aborted)
      throw new Error(
        "Import timed out. Reduce the edition size and try again.",
      );
    const raw = data.type === "file" ? data.file?.url : data.external?.url;
    const url = safeUrl(raw);
    if (!url || !url.startsWith("https:"))
      throw new Error("An image has an invalid URL.");
    let src = url;
    if (data.type === "file") {
      const host = new URL(url).hostname;
      if (
        !host.endsWith(".amazonaws.com") &&
        !host.endsWith(".notion-static.com")
      )
        throw new Error("Unrecognized Notion image host.");
      const response = await fetch(url, {
        redirect: "error",
        signal: AbortSignal.any([deadline, AbortSignal.timeout(8000)]),
      });
      let type = response.headers.get("content-type")?.split(";")[0] || "";
      if (
        !response.ok ||
        !["image/png", "image/jpeg", "image/gif", "image/webp"].includes(type)
      )
        throw new Error("Use PNG, JPEG, GIF or WebP images in the edition.");
      if (Number(response.headers.get("content-length") || 0) > 20000000)
        throw new Error("Each original image must be under 20 MB.");
      const reader = response.body?.getReader();
      if (!reader) throw new Error("Image could not be read.");
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 20000000) {
          await reader.cancel();
          throw new Error("Each original image must be under 20 MB.");
        }
        chunks.push(value);
      }
      let body = Buffer.concat(chunks);
      if (type === "image/gif" && size > 2000000)
        throw new Error("Animated GIFs must be under 2 MB.");
      if (size > 200000 && type !== "image/gif") {
        // Optimize photos throughout the edition, preserving transparency for
        // illustrations. Small files and animated GIFs keep their original bytes.
        const source = sharp(body, { limitInputPixels: 40000000 });
        const metadata = await source.metadata();
        const resized = source.rotate().resize({
          width: 1280,
          height: 2400,
          fit: "inside",
          withoutEnlargement: true,
        });
        body = await (
          metadata.hasAlpha
            ? resized.png({ palette: true, quality: 85 })
            : resized.jpeg({ quality: 82 })
        ).toBuffer();
        type = metadata.hasAlpha ? "image/png" : "image/jpeg";
      }
      if (body.length > 2000000 || imageBytes + body.length > 8000000)
        throw new Error(
          "Optimized images exceed the import limit (2 MB each, 8 MB per edition).",
        );
      imageBytes += body.length;
      const mediaId = randomUUID();
      await saveMedia(mediaId, {
        type,
        body: body.toString("base64"),
        campaignId: id,
      } satisfies StoredMedia);
      src = `${siteOrigin()}/api/newsletter-media/${mediaId}`;
    }
    const caption = richText(data.caption);
    return `<figure style="margin:24px 0"><img src="${escapeHtml(src)}" alt="${escapeHtml((data.caption || []).map((r) => r.plain_text || r.text?.content || "").join(""))}" style="max-width:100%;height:auto;display:block">${caption ? `<figcaption>${caption}</figcaption>` : ""}</figure>`;
  }
  async function children(parent: string, depth = 0): Promise<string> {
    if (depth > 10) throw new Error("The page is nested too deeply.");
    const blocks: Block[] = [];
    let cursor: string | null = null;
    do {
      const result: {
        results: Block[];
        has_more: boolean;
        next_cursor: string | null;
      } = await notion(
        `blocks/${encodeURIComponent(parent)}/children?page_size=100${cursor ? `&start_cursor=${encodeURIComponent(cursor)}` : ""}`,
      );
      blocks.push(...result.results);
      cursor = result.has_more ? result.next_cursor : null;
      blockCount += result.results.length;
      if (blockCount > 500)
        throw new Error("An edition can contain at most 500 blocks.");
    } while (cursor);
    let html = "";
    let list = "";
    for (const block of blocks) {
      const data = block[block.type] as BlockData;
      const type = block.type;
      const desiredList =
        type === "bulleted_list_item"
          ? "ul"
          : type === "numbered_list_item"
            ? "ol"
            : "";
      if (list && list !== desiredList) {
        html += `</${list}>`;
        list = "";
      }
      if (desiredList && !list) {
        list = desiredList;
        html += `<${list}>`;
      }
      const content = richText(data?.rich_text);
      const nested = block.has_children
        ? await children(block.id, depth + 1)
        : "";
      if (desiredList)
        html += `<li style="margin:8px 0">${content}${nested}</li>`;
      else if (type === "paragraph")
        html += `<p style="margin:16px 0;line-height:1.65">${content}</p>${nested}`;
      else if (/^heading_[123]$/.test(type)) {
        const level = Number(type.slice(-1)) + 1;
        html += `<h${level} style="margin:28px 0 12px">${content}</h${level}>${nested}`;
      } else if (["quote", "callout"].includes(type))
        html += `<blockquote style="margin:20px 0;padding:16px;background:#f4effa">${content}${nested}</blockquote>`;
      else if (type === "code")
        html += `<pre style="white-space:pre-wrap;background:#f4effa;padding:16px"><code>${content}</code></pre>`;
      else if (type === "divider") html += "<hr>";
      // Preserve equation source as text: email clients cannot run math scripts.
      else if (type === "equation")
        html += `<p style="margin:24px 0;text-align:center;white-space:pre-wrap">${escapeHtml(data.expression || "")}</p>`;
      else if (type === "image") html += await image(data);
      else if (type === "to_do")
        html += `<p>${data.checked ? "☑" : "☐"} ${content}</p>${nested}`;
      else if (type === "table")
        html += `<table style="border-collapse:collapse;width:100%"><tbody>${nested}</tbody></table>`;
      else if (type === "table_row")
        html += `<tr>${(data.cells || []).map((cell) => `<td style="border:1px solid #ddd;padding:8px">${richText(cell)}</td>`).join("")}</tr>`;
      else if (
        ["column_list", "column", "synced_block", "toggle"].includes(type)
      )
        html += `${content ? `<p><strong>${content}</strong></p>` : ""}${nested}`;
      else if (
        [
          "bookmark",
          "link_preview",
          "embed",
          "video",
          "file",
          "pdf",
          "audio",
        ].includes(type)
      ) {
        // Signed file URLs expire; require a stable external link for attachments.
        if (data.type === "file")
          throw new Error(
            `Replace the ${type} attachment with a permanent public link before importing.`,
          );
        const href = safeUrl(data.url || data.external?.url);
        if (!href) throw new Error(`Invalid ${type} link.`);
        html += `<p><a href="${escapeHtml(href)}">${richText(data.caption) || escapeHtml(data.title || `Open ${type}`)}</a></p>`;
      } else
        throw new Error(
          `Notion block “${type}” is not supported. Convert it to text, an image, or a link before importing.`,
        );
    }
    return html + (list ? `</${list}>` : "");
  }
  const html = await children(notionId);
  if (!html || Buffer.byteLength(html) > 180000)
    throw new Error("The edition is empty or too large (180 KB HTML limit).");
  return {
    id,
    notionId,
    title,
    html,
    createdAt: new Date().toISOString(),
    createdBy,
  };
}
export function emailDocument(page: ImportedPage, footer = ""): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(page.title)}</title><style>@media(max-width:600px){.notion-gallery,.notion-gallery tbody,.notion-gallery tr,.notion-gallery-cell{display:block!important;width:100%!important;box-sizing:border-box}.notion-gallery-cell{padding:12px 0!important}}</style></head><body style="margin:0;background:#faf8fc;color:#241632;font-family:Arial,sans-serif"><main style="max-width:640px;margin:auto;padding:32px 20px"><p style="font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#6b21a8">Purdue Hackers / Newsletter</p><h1 style="font-size:32px;line-height:1.2">${escapeHtml(page.title)}</h1>${imageLayout(page.html)}${footer}</main></body></html>`;
}
