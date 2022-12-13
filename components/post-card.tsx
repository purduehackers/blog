import { Post } from 'contentlayer/generated'
import { format, parseISO } from 'date-fns'
import Link from 'next/link'

const PostCard = (post: Post) => {
  return (
    <Link href={post.url}>
      <a>
        <div
          className="flex flex-col h-full justify-center text-center p-4 rounded-lg border-2 border-black"
          style={{ backgroundColor: post.color.bg }}
        >
          <time dateTime={post.date} className="text-sm text-gray-600">
            {format(
              parseISO(post.date.substring(0, post.date.length - 14)),
              'LLL d, yyyy'
            )}
          </time>
          <h2 className="text-3xl sm:text-2xl md:text-3xl font-bold">
            {post.title}
          </h2>
        </div>
      </a>
    </Link>
  )
}

export default PostCard
