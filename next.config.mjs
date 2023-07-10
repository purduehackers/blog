import { withContentlayer } from 'next-contentlayer'

/**
 * @type {import('next').NextConfig}
 */
const config = withContentlayer({
  experimental: {
    mdxRs: true
  },
  pageExtensions: ['js', 'ts', 'tsx', 'mdx'],
  images: {
    domains: ['github.com', 'cdn.discordapp.com', 'media.discordapp.net']
  }
})

export default config
