import { format, parseISO } from 'date-fns'
import { allPosts, Post } from 'contentlayer/generated'
import type { Metadata } from 'next'
import Nav from '@/components/nav'
import Author from '@/components/author'
import Footer from '@/components/footer'
import parseMarkdownLink from '@/lib/parse-markdown-link'
import colors from '@/lib/colors'
import { sortAsc } from '@/lib/sort'
import { notFound } from 'next/navigation'
import PostContent from '@/components/post-content'
import PostContentClient from '@/components/post-content-client'

interface PageProps {
  params: { slug: string }
}

export function generateStaticParams() {
  const paths = allPosts.map((post) => ({
    slug: post.url
  }))
  return paths
}

async function fetchPost(slug: string): Promise<Post | undefined> {
  const posts: Post[] = sortAsc(allPosts)
  posts.map((post, i) => (post.color = colors[i % colors.length]))
  const post = allPosts.find((post) => post._raw.flattenedPath === slug)
  if (!post) return
  return post
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

export async function generateMetadata({
  params
}: PageProps): Promise<Metadata> {
  const post = await fetchPost(params.slug)
  if (!post) return notFound()

  const authors: string[] = post.authors.split(',') || [post.authors]
  const ogImage = getOgImage({ title: post.title, authors })

  return {
    title: post.title,
    openGraph: {
      title: post.title,
      description: post.ogDescription,
      type: 'article',
      publishedTime: post.date,
      images: [ogImage]
    },
    twitter: {
      images: [ogImage],
      title: post.title,
      description: post.ogDescription
    }
  }
}

export default async function PostLayout({ params }: PageProps) {
  const post = await fetchPost(params.slug)
  if (!post) return notFound()

  const authors: string[] = post.authors.split(',') || [post.authors]

  const date = post.date.substring(0, post.date.length - 14)

  return (
    <>
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
        {post.clientComponent ? (
          <PostContentClient rawContent={post.body.code} />
        ) : (
          <PostContent rawContent={post.body.code} />
        )}
      </main>
      <Footer />
    </>
  )
}
