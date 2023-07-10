import Head from 'next/head'
import { format, parseISO } from 'date-fns'
import { allPosts, Post } from 'contentlayer/generated'
import { useMDXComponent } from 'next-contentlayer/hooks'
import { GetStaticProps } from 'next'
import Nav from '@/components/nav'
import Author from '@/components/author'
import components from '../../mdx-components'
import Footer from '@/components/footer'
import parseMarkdownLink from '@/lib/parse-markdown-link'
import colors from '@/lib/colors'
import { sortAsc } from '@/lib/sort'

export const getStaticPaths = async () => {
  const paths: string[] = allPosts.map((post) => post.url)
  return {
    paths,
    fallback: false
  }
}

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const posts: Post[] = sortAsc(allPosts)
  posts.map((post, i) => (post.color = colors[i % colors.length]))
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
      <main
        className="w-screen"
        style={{
          // @ts-expect-error custom properties
          '--postMain': post.color.main,
          '--postLight': post.color.mainLight
        }}
      >
        <header className={`border-b-4 border-black bg-${post.color.bgLight}`}>
          <Nav />
          <div className="w-full container py-8 md:pt-12 md:pb-16 flex flex-col items-start gap-y-4 mx-auto px-4 sm:px-8 md:px-14">
            <time
              dateTime={date}
              className="bg-white rounded-md border-2 border-black inline-block text-base px-2 mb-5"
            >
              {format(parseISO(date), 'LLLL d, yyyy')}
            </time>
            <h1 className="text-5xl sm:text-7xl font-bold sm:w-11/12 sm:tracking-tight">
              {post.title}
            </h1>
            <div className="flex flex-row gap-4 md:gap-x-5 flex-wrap w-10/12 md:max-w-2xl">
              {authors.map((author: string) => (
                <Author key={author} authorString={author} />
              ))}
            </div>
          </div>
        </header>
        <article className="mt-8 sm:mt-12 mb-12 sm:mb-16 text-lg font-serif flex flex-col items-start gap-y-4 justify-center w-11/12 sm:w-full max-w-2xl mx-auto">
          <Content components={components} />
        </article>
      </main>
      <div className="border-2 border-black mt-8"></div>
      <Footer />
    </>
  )
}

export default PostLayout
