import Head from 'next/head'
import { format, parseISO } from 'date-fns'
import { allPosts, Post } from 'contentlayer/generated'
import { useMDXComponent } from 'next-contentlayer/hooks'
import { GetStaticProps } from 'next'
import Nav from 'components/nav'

export const getStaticPaths = async () => {
  const paths: string[] = allPosts.map((post) => post.url)
  return {
    paths,
    fallback: false
  }
}

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const post = allPosts.find((post) => post._raw.flattenedPath === params?.slug)
  if (!post) return { notFound: true }
  return {
    props: {
      post
    }
  }
}

const PostLayout = ({ post }: { post: Post }) => {
  const Content = useMDXComponent(post.body.code)
  return (
    <>
      <Head>
        <title>{post.title} — Purdue Hackers</title>
      </Head>
      <article className="w-screen">
        <div className="bg-amber-100">
          <Nav />
          <div className="text-center pb-16 pt-8 sm:pt-12">
            <h1 className="text-5xl sm:text-7xl font-bold">{post.title}</h1>
            <time dateTime={post.date} className="text-lg text-gray-600 mb-1">
              {format(parseISO(post.date), 'LLLL d, yyyy')}
            </time>
          </div>
        </div>
        <div className="border-2 border-black"></div>
        <div className="mt-4 sm:mt-8 mx-auto text-lg font-serif flex flex-col items-start justify-center w-11/12 sm:w-full max-w-2xl mx-auto">
          <Content />
        </div>
      </article>
    </>
  )
}

export default PostLayout
