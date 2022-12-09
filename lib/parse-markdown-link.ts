const parseMarkdownLink = (link: string) => {
  const match = /\[(.+?)\]\((https?:\/\/[a-zA-Z0-9/.(-]+?)\)/g.exec(link)
  return {
    author: match?.[1] || 'Unknown',
    avatarUrl: match?.[2] || 'https://github.com/purduehackers.png'
  }
}

export default parseMarkdownLink
