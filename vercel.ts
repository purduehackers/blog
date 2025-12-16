import type { VercelConfig } from '@vercel/config/v1';

export const config: VercelConfig = {
  buildCommand: "pnpm run build",
  cleanUrls: true,
  devCommand: "pnpm run dev",
  framework: "astro",
  installCommand: "pnpm install",
  outputDirectory: "dist",
  trailingSlash: false
}
