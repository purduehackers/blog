export const parseMarkdownLink = (link: string) => {
  const match = /\[(.+?)\]\((https?:\/\/[a-zA-Z0-9/.(-]+?)?\)/g.exec(link);
  return {
    author: match?.[1] || "Unknown",
    avatarUrl: match?.[2] || "https://github.com/purduehackers.png",
  };
};

export const getOgImage = ({
  title,
  authors,
}: {
  title: string;
  authors: string[];
}) => {
  let authorImages = "";
  for (const author of authors) {
    const { avatarUrl } = parseMarkdownLink(author);
    authorImages += `&images=${encodeURIComponent(avatarUrl)}`;
  }
  return `https://og.purduehackers.com/${encodeURIComponent(
    title,
  )}.png?theme=light&md=1&fontSize=200px&caption=${authorImages}`;
};
