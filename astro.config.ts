import { defineConfig } from "astro/config";
import { fileURLToPath } from "node:url";

import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import react from "@astrojs/react";
import tailwind from "@astrojs/tailwind";
import vercel from "@astrojs/vercel/serverless";
// import playformCompress from "@playform/compress";

export default defineConfig({
  site: "https://blog.purduehackers.com",
  output: "hybrid",
  adapter: vercel({
    webAnalytics: {
      enabled: true,
    },
  }),
  integrations: [
    {
      name: "separate-development-and-build-caches",
      hooks: {
        "astro:config:setup": ({ command, updateConfig }) => {
          // Builds also prebundle dependencies. Sharing their production React
          // cache with a running dev server creates incompatible React copies.
          updateConfig({
            vite: {
              cacheDir: fileURLToPath(
                new URL(
                  `./node_modules/.vite-astro-${command}/`,
                  import.meta.url,
                ),
              ),
            },
          });
        },
      },
    },
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
      external: ["@resvg/resvg-js", "satori", "wawoff2"],
    },
    optimizeDeps: {
      include: ["react-dom/client"],
      exclude: ["@resvg/resvg-js"],
    },
  },
});
