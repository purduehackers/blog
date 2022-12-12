import { Post } from 'contentlayer/generated'
import { format, parseISO } from 'date-fns'
import Link from 'next/link'

const PostCard = (post: Post) => {
  return (
    <Link href={post.url}>
      <div
        className={`flex flex-col justify-center text-center p-4 rounded-lg border-2 border-black cursor-pointer`}
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
    </Link>
  )
}

export default PostCard
