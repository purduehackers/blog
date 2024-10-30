/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    fontFamily: {
      main: '"Space Grotesk", system-ui, Roboto, sans-serif',
      serif: '"IBM Plex Serif", serif',
      mono: '"Space Mono", monospace',
    },
    extend: {
      boxShadow: {
        blocks: "2px 2px",
      },
      colors: {
        post: "var(--postMain)",
        "post-light": "var(--postLight)",
        discord: {
          vibrant: "#5864f4",
        },
      },
    },
  },
  safelist: [
    "bg-red-200",
    "bg-red-100",
    "hover:bg-[#f87171]",
    "bg-orange-200",
    "bg-orange-100",
    "hover:bg-[#fb923c]",
    "bg-amber-200",
    "bg-amber-100",
    "hover:bg-[#fbbf24]",
    "bg-green-200",
    "bg-green-100",
    "hover:bg-[#4ade80]",
    "bg-teal-200",
    "bg-teal-100",
    "hover:bg-[#2dd4bf]",
    "bg-violet-200",
    "bg-violet-100",
    "hover:bg-[#a78bfa]",
    "bg-pink-200",
    "bg-pink-100",
    "hover:bg-[#f472b6]",
  ],
  plugins: [],
};
