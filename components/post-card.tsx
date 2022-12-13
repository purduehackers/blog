import { Post } from 'contentlayer/generated'
import { format, parseISO } from 'date-fns'
import Link from 'next/link'

const PostCard = (post: Post) => {
  return (
    <Link href={post.url}>
      <a>
        <div
          className={`flex flex-col h-full rounded-lg border-[3px] border-black bg-${post.color.bg} hover:bg-[${post.color.mainLight}] transition duration-100`}
        >
          <div className="flex flex-col justify-center text-center p-4">
            <h2 className="text-3xl sm:text-2xl md:text-3xl font-bold">
              {post.title}
            </h2>
          </div>
          <time
            dateTime={post.date}
            className="mt-auto mr-auto ml-1 mb-1 bg-gray-200 border-2 border-black rounded-md px-1 text-sm text-gray-600"
          >
            {format(
              parseISO(post.date.substring(0, post.date.length - 14)),
              'LLL d, yyyy'
            )}
          </time>
        </div>
      </a>
    </Link>
  )
}

export default PostCard
