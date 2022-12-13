/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './posts/*.mdx',
    './lib/*.{js,ts}'
  ],
  safelist: [
    'bg-red-200',
    'bg-red-100',
    'hover:bg-[#f87171]',
    'bg-orange-200',
    'bg-orange-100',
    'hover:bg-[#fb923c]',
    'bg-amber-200',
    'bg-amber-100',
    'hover:bg-[#fbbf24]',
    'bg-green-200',
    'bg-green-100',
    'hover:bg-[#4ade80]',
    'bg-teal-200',
    'bg-teal-100',
    'hover:bg-[#2dd4bf]',
    'bg-indigo-200',
    'bg-indigo-100',
    'hover:bg-[#818cf8]',
    'bg-violet-200',
    'bg-violet-100',
    'hover:bg-[#a78bfa]'
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
      },
      colors: {
        post: 'var(--postMain)',
        'post-light': 'var(--postLight)'
      }
    }
  },
  plugins: []
}
