import type { Config } from "tailwindcss";

const config = {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  darkMode: "class",
  theme: {
    fontFamily: {
      main: ['"PolySans"', "system-ui", "sans-serif"],
      mono: ['"Inconsolata"', '"JetBrains Mono"', "monospace"],
      pixel: ['"PixelHackers"', "monospace"],
      display: ['"Silkscreen"', "monospace"],
    },
    extend: {
      colors: {
        yellow: { DEFAULT: "#fdfa4a", 400: "#fdfa4a" },
        amber: { 400: "#fbbf24", 500: "#FFA600" },
        purple: { 400: "#c497ff", 700: "#8B33FF" },
        gray: {
          100: "#f5f5f5",
          800: "#1e1e23",
          900: "#101013",
        },
        discord: { vibrant: "#5864f4" },
      },
    },
  },
  plugins: [],
} satisfies Config;

export default config;
