import Head from 'next/head'
import { compareDesc, format, parseISO } from 'date-fns'
import { allPosts, Post } from 'contentlayer/generated'
import Link from 'next/link'

const PostCard = (post: Post) => {
  return (
    <div className="mb-8">
      <h2 className="text-xl">
        <Link href={post.url}>
          <a className="text-amber-500 hover:text-amber-400 transition">
            {post.title}
          </a>
        </Link>
      </h2>
      <time dateTime={post.date} className="block text-xs text-gray-600 mb-2">
        {format(parseISO(post.date), 'LLLL d, yyyy')}
      </time>
    </div>
  )
}

const Home = ({ posts }: { posts: Post[] }) => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center py-2">
      <Head>
        <title>Create Next App</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="flex w-full flex-1 flex-col items-center justify-center px-20 text-center">
        {posts.map((post, idx) => (
          <PostCard key={idx} {...post} />
        ))}
      </main>
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
