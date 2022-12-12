import { Post } from 'contentlayer/generated'
import { format, parseISO } from 'date-fns'
import Link from 'next/link'

const PostCard = (post: Post) => {
  return (
    <div className="flex flex-col gap-x-2 flex-1 pt-4">
      <time
        dateTime={post.date}
        className="text-sm flex items-center text-gray-600"
      >
        {format(
          parseISO(post.date.substring(0, post.date.length - 14)),
          'LLL d, yyyy'
        )}
      </time>
      <h2 className="text-3xl sm:text-4xl font-bold">
        <Link href={post.url}>
          <a className="text-amber-500 hover:text-amber-400 transition">
            {post.title}
          </a>
        </Link>
      </h2>
    </div>
  )
}

export default PostCard
