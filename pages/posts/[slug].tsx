import Head from 'next/head'
import { format, parseISO } from 'date-fns'
import { allPosts, Post } from 'contentlayer/generated'
import { useMDXComponent } from 'next-contentlayer/hooks'
import { GetStaticProps } from 'next'
import Nav from 'components/nav'
import Author from 'components/author'

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
  const authors: string[] = post.authors.split(',') || [post.authors]
  return (
    <>
      <Head>
        <title>{post.title} — Purdue Hackers</title>
      </Head>
      <article className="w-screen">
        <div className="bg-amber-100 border-b-4 border-black">
          <Nav />
          <div className="text-center pb-16 pt-8 sm:pt-12 flex flex-col gap-y-4">
            <h1 className="text-5xl sm:text-7xl font-bold">{post.title}</h1>
            <div className="flex flex-row gap-x-2 justify-center">
              {authors.map((author: string) => (
                <Author authorString={author} />
              ))}
            </div>
          </div>
          <div className="bg-gray-200 rounded-full px-1 mx-2 mb-2 border-2 border-black inline-block">
            <time dateTime={post.date} className="text-sm mx-2">
              {format(parseISO(post.date), 'LLLL d, yyyy')}
            </time>
          </div>
        </div>
        <div className="mt-4 sm:mt-8 text-lg font-serif flex flex-col items-start gap-y-3 justify-center w-11/12 sm:w-full max-w-2xl mx-auto mb-12">
          <Content />
        </div>
      </article>
    </>
  )
}

export default PostLayout
