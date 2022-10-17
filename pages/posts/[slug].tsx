import Head from 'next/head'
import { format, parseISO } from 'date-fns'
import { allPosts, Post } from 'contentlayer/generated'
import { useMDXComponent } from 'next-contentlayer/hooks'
import { GetStaticProps } from 'next'
import Nav from 'components/nav'
import Author from 'components/author'
import components from '../../lib/components'
import Footer from 'components/footer'
import FooterLinks from 'components/footer-links'

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
  const date = post.date.substring(0, post.date.length - 14)
  return (
    <>
      <Head>
        <title>{post.title} — Purdue Hackers</title>
      </Head>
      <article className="w-screen">
        <div className="bg-amber-100 border-b-4 border-black">
          <Nav />
          <div className="text-center pb-16 pt-8 sm:pt-12 flex flex-col gap-y-4 items-center max-w-3xl mx-auto">
            <h1 className="text-5xl sm:text-7xl font-bold">{post.title}</h1>
            <div className="flex flex-row gap-2 justify-center flex-wrap max-w-2xl">
              {authors.map((author: string) => (
                <Author key={author} authorString={author} />
              ))}
            </div>
          </div>
          <div className="bg-gray-200 rounded-full px-1 mx-2 mb-2 border-2 border-black inline-block">
            <time dateTime={date} className="text-sm mx-2">
              {format(parseISO(date), 'LLLL d, yyyy')}
            </time>
          </div>
        </div>
        <div className="mt-4 sm:mt-8 text-lg font-serif flex flex-col items-start gap-y-3 justify-center w-11/12 sm:w-full max-w-2xl mx-auto">
          <Content components={components} />
        </div>
        <div className="border-2 border-black mt-8"></div>
      </article>
      <Footer>
        <p>
          Made with 💛 and ⚡️ •{' '}
          <span className="underline underline-offset-4 decoration-2">
            <a
              href="https://github.com/purduehackers/blog"
              target="_blank"
              className="decoration-amber-400 dark:decoration-amber-500 hover:decoration-[3px]"
            >
              Open source
            </a>
          </span>{' '}
          •{' '}
          <span className="underline underline-offset-4 decoration-2">
            <a
              href="https://vercel.com?utm_source=purdue-hackers&utm_campaign=oss"
              target="_blank"
              className="decoration-amber-400 dark:decoration-amber-500 hover:decoration-[3px]"
            >
              Powered by ▲Vercel.
            </a>
          </span>
        </p>
        <FooterLinks />
      </Footer>
    </>
  )
}

export default PostLayout
