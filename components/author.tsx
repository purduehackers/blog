import Image from 'next/future/image'
import parseMarkdownLink from 'lib/parse-markdown-link'

const Author = ({ authorString }: { authorString: string }) => {
  const { author, avatarUrl } = parseMarkdownLink(authorString)
  return (
    <span className="flex flex-row gap-x-2 items-center text-lg">
      <Image
        src={avatarUrl}
        width={32}
        height={32}
        alt={`Avatar for ${author}`}
        className="rounded-full"
      />
      {author}
    </span>
  )
}

export default Author
