import { defineConfig } from "astro/config";

import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import react from "@astrojs/react";
import tailwind from "@astrojs/tailwind";
import vercel from "@astrojs/vercel/static";
// import playformCompress from "@playform/compress";

export default defineConfig({
  site: "https://blog.purduehackers.com",
  output: "static",
  adapter: vercel({
    webAnalytics: {
      enabled: true,
    },
  }),
  integrations: [
    mdx(),
    react(),
    tailwind({
      configFile: "./tailwind.config.ts",
      applyBaseStyles: false,
    }),
    sitemap(),
    // playformCompress({ Logger: 1 }),
  ],

  server: {
    port: 3000,
  },

  prefetch: {
    prefetchAll: true,
    defaultStrategy: "viewport",
  },
  vite: {
    ssr: {
      noExternal: ["@purduehackers/time"], // Force Vite to treat this package as ESM
    },
  },
});
