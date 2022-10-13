const parseMarkdownLink = (link: string) => {
  const match = /\[(.+?)\]\((https?:\/\/[a-zA-Z0-9/.(]+?)\)/g.exec(link)
  return {
    author: match?.[1] || 'Unknown',
    avatarUrl: match?.[2] || 'https://mbs.zone/geck'
  }
}

export default parseMarkdownLink
