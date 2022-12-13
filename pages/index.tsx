import Head from 'next/head'
import { allPosts, Post } from 'contentlayer/generated'
import Footer from 'components/footer'
import PostCard from 'components/post-card'
import colors from 'lib/colors'
import { sortAsc, sortDesc } from 'lib/sort'

const Home = ({ posts }: { posts: Post[] }) => (
  <div className="min-h-screen">
    <Head>
      <title>Blog — Purdue Hackers</title>
    </Head>
    <div className="bg-cyan-100 border-b-4 border-black">
      <div className="text-center py-16 sm:py-20 flex flex-col gap-y-4 items-center">
        <h1 className="text-4xl sm:text-7xl font-bold">Purdue Hackers Blog</h1>
        <h2 className="text-xl text-gray-600">
          Where we share our magic with the world ✨💛⚡️
        </h2>
      </div>
    </div>
    <div className="max-w-sm sm:max-w-6xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-8 sm:pt-14 px-5 sm:px-20 mx-auto">
      {posts.map((post, idx) => (
        <PostCard key={idx} {...post} />
      ))}
    </div>
    <div className="border-2 border-black mt-8 sm:mt-14"></div>
    <Footer />
  </div>
)

export async function getStaticProps() {
  sortAsc(allPosts).map((post, i) => (post.color = colors[i % colors.length]))
  const posts = sortDesc(allPosts) as Partial<Post>[]

  // By default, Contentlayer sends Posts with all their data, including the entire article.
  // We don't need this data on the index page, and it was causing a Next.js "large page data" error.
  for (const post of posts) {
    delete post.body
  }

  return { props: { posts } }
}

export default Home
