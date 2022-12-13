import { Post } from 'contentlayer/generated'
import { format, parseISO } from 'date-fns'
import Link from 'next/link'

const PostCard = (post: Post) => {
  return (
    <Link href={post.url}>
      <a>
        <div
          className={`flex py-4 px-3 gap-2 flex-col h-full justify-center rounded-lg border-[3px] border-black bg-${post.color.bg} hover:bg-[${post.color.mainLight}] transition duration-100`}
        >
          <time
            dateTime={post.date}
            className="text-sm rounded-md px-2 mx-auto bg-white border-2 border-black mr-auto"
          >
            {format(
              parseISO(post.date.substring(0, post.date.length - 14)),
              'LLL d, yyyy'
            )}
          </time>
          <h2 className="text-center text-3xl sm:text-2xl md:text-3xl font-bold">
            {post.title}
          </h2>
        </div>
      </a>
    </Link>
  )
}

export default PostCard
