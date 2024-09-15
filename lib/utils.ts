import { Post } from 'contentlayer/generated'
import fs from 'fs'
import RSS from 'rss'

// Kindly taken from this wonderful blog post
// https://dev.to/promathieuthiry/creating-an-rss-feed-in-your-nextjs-project-20em
export default async function generateRssFeed(allPosts: Post[]) {
  const site_url =
    process.env.NODE_ENV === 'production'
      ? 'https://blog.purduehackers.com/'
      : 'http://localhost:3000/'

  const feedOptions = {
    title: 'Purdue Hackers RSS',
    description: 'Where we share our magic with the world ✨💛⚡️',
    site_url: site_url,
    feed_url: site_url + 'rss.xml',
    pubDate: new Date()
  }

  const feed = new RSS(feedOptions)
  allPosts.map((post) => {
    feed.item({
      title: post.title,
      description: post.ogDescription || '',
      url: site_url + post.url,
      date: post.date
    })
  })

  fs.writeFileSync('./public/rss.xml', feed.xml({ indent: true }))
}
