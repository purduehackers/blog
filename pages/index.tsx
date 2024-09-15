import Head from 'next/head'
import { allPosts, Post } from 'contentlayer/generated'
import Footer from 'components/footer'
import PostCard from 'components/post-card'
import colors from 'lib/colors'
import { sortAsc, sortDesc } from 'lib/sort'
import { pick } from 'contentlayer/client'
import generateRssFeed from 'lib/utils'

const Home = ({ posts }: { posts: Post[] }) => (
  <div className="min-h-screen flex flex-col">
    <Head>
      <title>Blog — Purdue Hackers</title>
    </Head>
    <header className="bg-cyan-100 border-b-4 border-black">
      <div className="text-center py-16 sm:py-20 flex flex-col gap-y-4 items-center">
        <h1 className="text-4xl sm:text-7xl sm:tracking-tight font-bold">
          Purdue Hackers Blog
        </h1>
        <h2 className="text-xl text-zinc-600">
          Where we share our magic with the world ✨💛⚡️
        </h2>
      </div>
    </header>
    <div className="max-w-sm sm:max-w-6xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 py-8 sm:py-14 px-5 sm:px-20 mx-auto">
      {posts.map((post) => (
        <PostCard key={post.url} {...post} />
      ))}
    </div>
    <Footer />
  </div>
)

export async function getStaticProps() {
  sortAsc(allPosts).map((post, i) => (post.color = colors[i % colors.length]))
  const posts = sortDesc(allPosts).map((post) =>
    pick(post, ['title', 'date', 'url', 'color'])
  )
  generateRssFeed(allPosts);
  return { props: { posts } }
}

export default Home
