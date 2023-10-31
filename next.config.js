const { withContentlayer } = require('next-contentlayer')

/**
 * @type {import('next').NextConfig}
 */
const config = withContentlayer({
  swcMinify: true,
  pageExtensions: ['js', 'ts', 'tsx', 'mdx'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'github.com',
        port: '',
        pathname: '/**'
      },
      {
        protocol: 'https',
        hostname: 'cdn.discordapp.com',
        port: '',
        pathname: '/**'
      },
      {
        protocol: 'https',
        hostname: 'media.discordapp.net',
        port: '',
        pathname: '/**'
      }
    ]
  },
  // Importing a pdf broke on app router for some reason, no idea why
  // This fixes it, no idea why
  webpack: (config) => {
    config.module.rules.push({
      test: /\.pdf/,
      type: 'asset/resource',
      generator: {
        filename: 'static/[hash][ext]'
      }
    })

    return config
  }
})

module.exports = config
