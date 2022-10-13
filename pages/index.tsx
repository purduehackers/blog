import Head from 'next/head'
import { compareDesc, format, parseISO } from 'date-fns'
import { allPosts, Post } from 'contentlayer/generated'
import Link from 'next/link'
import Date from 'components/date'

const PostCard = (post: Post) => {
  return (
    <h2 className="text-3xl font-bold">
      <Link href={post.url}>
        <a className="text-amber-500 hover:text-amber-400 transition">
          {post.title}
        </a>
      </Link>
    </h2>
  )
}

const Home = ({ posts }: { posts: Post[] }) => {
  return (
    <div className="min-h-screen">
      <Head>
        <title>Blog — Purdue Hackers</title>
      </Head>
      <div className="bg-cyan-100 border-b-4 border-black">
        <div className="text-center py-16 sm:py-20 flex flex-col gap-y-4 items-center">
          <h1 className="text-5xl sm:text-7xl font-bold">
            Purdue Hackers Blog
          </h1>
          <h2 className="text-2xl text-gray-600">
            Where we share our magic with the world ✨💛⚡️
          </h2>
        </div>
      </div>
      <div className="w-11/12 sm:max-w-xl mx-auto rounded border-2 border-black shadow-blocks shadow-gray-800 p-4 mt-8 flex flex-col align-center gap-y-4">
        {posts.map((post, idx) => (
          <div className="grid grid-cols-2 gap-x-4">
            {/* <time
              dateTime={post.date}
              className="block text-base text-right text-gray-600"
            >
              {format(parseISO(post.date), 'LLL d, yyyy')}
            </time> */}
            <Date date={parseISO(post.date)} />
            <PostCard key={idx} {...post} />
          </div>
        ))}
      </div>
    </div>
  )
}

export async function getStaticProps() {
  const posts: Post[] = allPosts.sort((a: Post, b: Post) => {
    return compareDesc(new Date(a.date), new Date(b.date))
  })
  return { props: { posts } }
}

export default Home
