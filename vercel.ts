import { routes, type VercelConfig } from '@vercel/config/v1';

export const config: VercelConfig = {
  buildCommand: "pnpm run build",
  cleanUrls: true,
  devCommand: "pnpm run dev",
  framework: "astro",
  installCommand: "pnpm install",
  outputDirectory: "dist",
  trailingSlash: false,
  redirects: [
    routes.redirect('/home', 'https://purduehackers.com')
  ],
  build: {
    env: {
      VERCEL_DEBUG: '1'
    }
  }
}
