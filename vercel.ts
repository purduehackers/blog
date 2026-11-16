import type { VercelConfig } from '@vercel/config/v1';

export const config: VercelConfig = {
  cleanUrls: true,
  framework: "astro",
  outputDirectory: "dist",
  trailingSlash: false
}
