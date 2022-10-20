import Image from 'next/future/image'
import parseMarkdownLink from 'lib/parse-markdown-link'

const Author = ({ authorString }: { authorString: string }) => {
  const { author, avatarUrl } = parseMarkdownLink(authorString)
  return (
    <span className="flex flex-row gap-x-1 items-center">
      <Image
        src={avatarUrl}
        width={25}
        height={25}
        alt={`Avatar for ${author}`}
        className="w-[30px] rounded-full"
      />
      <p className="text-lg">{author}</p>
    </span>
  )
}

export default Author
