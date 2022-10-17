/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './posts/*.{mdx}',
    './lib/*.{js,ts}'
  ],
  theme: {
    fontFamily: {
      main: '"Space Grotesk", system-ui, Roboto, sans-serif',
      serif: '"IBM Plex Serif"',
      mono: '"Space Mono"'
    },
    extend: {
      boxShadow: {
        blocks: '2px 2px'
      }
    }
  },
  plugins: []
}
