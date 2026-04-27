/** @jsxImportSource react */
import React from "react";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
// @ts-expect-error - wawoff2 has no types
import wawoff from "wawoff2";
import fs from "node:fs/promises";
import path from "node:path";

import { parseMarkdownLink } from "./utils";

const FONT_PATH = path.resolve(
  process.cwd(),
  "src/assets/fonts/PixelHackers.woff2",
);

let cachedFont: ArrayBuffer | null = null;

async function loadFont(): Promise<ArrayBuffer> {
  if (cachedFont) return cachedFont;
  const woff2 = await fs.readFile(FONT_PATH);
  const ttf: Uint8Array = await wawoff.decompress(woff2);
  const buf = ttf.buffer.slice(
    ttf.byteOffset,
    ttf.byteOffset + ttf.byteLength,
  ) as ArrayBuffer;
  cachedFont = buf;
  return buf;
}

const avatarCache = new Map<string, string>();

async function fetchAvatarDataUri(url: string): Promise<string | null> {
  if (avatarCache.has(url)) return avatarCache.get(url)!;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    const ct = res.headers.get("content-type") || "image/png";
    const dataUri = `data:${ct};base64,${Buffer.from(ab).toString("base64")}`;
    avatarCache.set(url, dataUri);
    return dataUri;
  } catch {
    return null;
  }
}

const emojiCache = new Map<string, string>();

async function loadEmoji(segment: string): Promise<string> {
  const cached = emojiCache.get(segment);
  if (cached) return cached;
  const url = `https://emojicdn.elk.sh/${encodeURIComponent(segment)}?style=apple`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      emojiCache.set(segment, "");
      return "";
    }
    const ab = await res.arrayBuffer();
    const ct = res.headers.get("content-type") || "image/png";
    const dataUri = `data:${ct};base64,${Buffer.from(ab).toString("base64")}`;
    emojiCache.set(segment, dataUri);
    return dataUri;
  } catch {
    emojiCache.set(segment, "");
    return "";
  }
}

const loadAdditionalAsset = async (code: string, segment: string) => {
  if (code === "emoji") return loadEmoji(segment);
  return [];
};

const WIDTH = 1200;
const HEIGHT = 630;
const GRID = 40;
const BG = "#0b0b0d";
const YELLOW = "#fdfa4a";

const gridSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='${GRID}' height='${GRID}'><path d='M ${GRID} 0 L 0 0 0 ${GRID}' fill='none' stroke='rgba(255,255,255,0.10)' stroke-width='1'/></svg>`;
const gridBg = `url("data:image/svg+xml;utf8,${encodeURIComponent(gridSvg)}")`;

function formatDate(d: Date): string {
  return d
    .toLocaleDateString("en-us", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    })
    .toUpperCase();
}

async function svgToPng(svg: string): Promise<Buffer> {
  return new Resvg(svg, {
    fitTo: { mode: "width", value: WIDTH },
  })
    .render()
    .asPng();
}

const baseFrameStyle: React.CSSProperties = {
  width: WIDTH,
  height: HEIGHT,
  display: "flex",
  flexDirection: "column",
  backgroundColor: BG,
  backgroundImage: gridBg,
  backgroundSize: `${GRID}px ${GRID}px`,
  fontFamily: "PixelHackers",
  color: "white",
};

interface PostOgOptions {
  title: string;
  pubDate: Date;
  authors: string[];
}

export async function renderPostOg(opts: PostOgOptions): Promise<Buffer> {
  const font = await loadFont();
  const authorData = await Promise.all(
    opts.authors.map(async (a) => {
      const { author, avatarUrl } = parseMarkdownLink(a);
      const avatar = await fetchAvatarDataUri(avatarUrl);
      return { author, avatar };
    }),
  );

  const titleLen = opts.title.length;
  const titleSize = titleLen > 60 ? 78 : titleLen > 40 ? 96 : 112;

  const svg = await satori(
    <div style={{ ...baseFrameStyle, padding: "70px 80px" }}>
      <div
        style={{
          display: "flex",
          alignSelf: "flex-start",
          border: "2px solid white",
          borderRadius: 4,
          padding: "10px 18px",
          fontSize: 28,
          letterSpacing: 1,
          textTransform: "uppercase",
        }}
      >
        {formatDate(opts.pubDate)}
      </div>

      <div
        style={{
          display: "flex",
          flex: 1,
          marginTop: 40,
          marginBottom: 30,
          fontSize: titleSize,
          lineHeight: 1.08,
          color: YELLOW,
          textTransform: "uppercase",
        }}
      >
        {opts.title}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "row",
          gap: 32,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {authorData.map(({ author, avatar }) => (
          <div
            key={author}
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
              fontSize: 28,
              textTransform: "uppercase",
            }}
          >
            {avatar ? (
              <img
                src={avatar}
                width={48}
                height={48}
                style={{
                  borderRadius: 9999,
                  border: "1px solid black",
                }}
              />
            ) : null}
            <span>{author}</span>
          </div>
        ))}
      </div>
    </div>,
    {
      width: WIDTH,
      height: HEIGHT,
      fonts: [
        { name: "PixelHackers", data: font, weight: 400, style: "normal" },
      ],
      loadAdditionalAsset,
    },
  );

  return svgToPng(svg);
}

interface IndexOgOptions {
  title: string;
  caption?: string;
}

export async function renderIndexOg(opts: IndexOgOptions): Promise<Buffer> {
  const font = await loadFont();

  const svg = await satori(
    <div
      style={{
        ...baseFrameStyle,
        justifyContent: "center",
        alignItems: "center",
        padding: 80,
      }}
    >
      <div
        style={{
          display: "flex",
          color: YELLOW,
          fontSize: 180,
          lineHeight: 1.05,
          textTransform: "uppercase",
        }}
      >
        {opts.title}
      </div>
      {opts.caption ? (
        <div
          style={{
            display: "flex",
            color: "white",
            fontSize: 32,
            marginTop: 28,
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          {opts.caption}
        </div>
      ) : null}
    </div>,
    {
      width: WIDTH,
      height: HEIGHT,
      fonts: [
        { name: "PixelHackers", data: font, weight: 400, style: "normal" },
      ],
      loadAdditionalAsset,
    },
  );

  return svgToPng(svg);
}
