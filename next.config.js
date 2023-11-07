const { withContentlayer } = require('next-contentlayer')

/**
 * @type {import('next').NextConfig}
 */
const config = withContentlayer({
  swcMinify: true,
  pageExtensions: ['js', 'ts', 'tsx', 'mdx'],
  images: {
    domains: ['github.com', 'cdn.discordapp.com', 'media.discordapp.net']
  },
  transpilePackages: ['geist']
})

module.exports = config
