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
import parseMarkdownLink from 'lib/parse-markdown-link'

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

const getOgImage = ({
  title,
  authors
}: {
  title: string
  authors: string[]
}) => {
  let authorImages = ''
  for (const author of authors) {
    const { avatarUrl } = parseMarkdownLink(author)
    authorImages += `&images=${encodeURIComponent(avatarUrl)}`
  }
  return `https://og.purduehackers.com/${encodeURIComponent(
    title
  )}.png?theme=light&md=1&fontSize=200px&caption=${authorImages}`
}

const PostLayout = ({ post }: { post: Post }) => {
  const Content = useMDXComponent(post.body.code)
  const authors: string[] = post.authors.split(',') || [post.authors]
  const date = post.date.substring(0, post.date.length - 14)
  const ogImage = getOgImage({ title: post.title, authors })
  return (
    <>
      <Head>
        <title>{post.title} | Purdue Hackers</title>
        <meta property="og:site_name" content="Purdue Hackers" />
        <meta property="og:name" content={`${post.title} | Purdue Hackers`} />
        <meta property="og:title" content={`${post.title} | Purdue Hackers`} />
        <meta property="og:image" content={ogImage} />
        <meta property="twitter:image" content={ogImage} />
        <meta property="og:description" content={post.ogDescription} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta property="og:type" content="website" />
      </Head>
      <article className="w-screen">
        <div className="bg-amber-100 border-b-4 border-black">
          <Nav />
          <div className="text-center pb-16 pt-8 sm:pt-12 flex flex-col gap-y-6 items-center max-w-3xl mx-auto">
            <h1 className="text-5xl sm:text-7xl font-bold w-11/12">
              {post.title}
            </h1>
            <div className="flex flex-row gap-2 sm:gap-4 justify-center flex-wrap w-10/12 md:max-w-2xl">
              {authors.map((author: string) => (
                <Author key={author} authorString={author} />
              ))}
            </div>
          </div>
          <div className="bg-gray-200 rounded-full px-1 mx-2 mb-2 border-2 border-black inline-block">
            <time dateTime={date} className="text-base mx-2">
              {format(parseISO(date), 'LLLL d, yyyy')}
            </time>
          </div>
        </div>
        <div className="mt-4 sm:mt-8 mb-12 sm:mb-16 text-lg font-serif flex flex-col items-start gap-y-3 justify-center w-11/12 sm:w-full max-w-2xl mx-auto">
          <Content components={components} />
        </div>
        <div className="border-2 border-black mt-8"></div>
      </article>
      <Footer>
        <p className="text-lg">
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
