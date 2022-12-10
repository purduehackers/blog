import Head from 'next/head'
import { compareDesc, format, parseISO } from 'date-fns'
import { allPosts, Post } from 'contentlayer/generated'
import Link from 'next/link'
import Footer from 'components/footer'

const PostCard = (post: Post) => {
  return (
    <div className="flex flex-col gap-x-2 flex-1 pt-4">
      <time
        dateTime={post.date}
        className="text-sm flex items-center text-gray-600"
      >
        {format(
          parseISO(post.date.substring(0, post.date.length - 14)),
          'LLL d, yyyy'
        )}
      </time>
      <h2 className="text-3xl sm:text-4xl font-bold">
        <Link href={post.url}>
          <a className="text-amber-500 hover:text-amber-400 transition">
            {post.title}
          </a>
        </Link>
      </h2>
    </div>
  )
}

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
    <div className="container flex flex-col py-4 sm:pt-14 px-5 sm:px-20 text-left mx-auto items-center">
      <div className="divide-y space-y-4 divide-black">
        {posts.map((post, idx) => (
          <PostCard key={idx} {...post} />
        ))}
      </div>
    </div>
    <div className="border-2 border-black mt-14"></div>
    <Footer />
  </div>
)

export async function getStaticProps() {
  const posts: Post[] = allPosts.sort((a: Post, b: Post) => {
    return compareDesc(new Date(a.date), new Date(b.date))
  })
  return { props: { posts } }
}

export default Home
