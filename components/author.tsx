import parseMarkdownLink from 'lib/parse-markdown-link'

const Author = ({ authorString }: { authorString: string }) => {
  const { author, avatarUrl } = parseMarkdownLink(authorString)
  return (
    <span className="flex flex-row gap-x-1 items-center">
      <img src={avatarUrl} className="w-[25px] rounded-full" />
      <p>{author}</p>
    </span>
  )
}

export default Author
