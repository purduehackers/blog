/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    fontFamily: {
      main: '"Space Grotesk", system-ui, Roboto, sans-serif',
      serif: '"IBM Plex Serif"',
      mono: '"IBM Plex Mono"'
    },
    extend: {}
  },
  plugins: []
}
