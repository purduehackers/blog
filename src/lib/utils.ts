export const parseMarkdownLink = (link: string) => {
  const match = /\[(.+?)\]\((https?:\/\/[a-zA-Z0-9/.(-]+?)?\)/g.exec(link);
  return {
    author: match?.[1] || "Unknown",
    avatarUrl: match?.[2] || "https://github.com/purduehackers.png",
  };
};

export const getOgImage = ({
  type,
  slug,
}: {
  type: "blog" | "vip-newsletter";
  slug: string;
}) => {
  const dir = type === "vip-newsletter" ? "vip-newsletter" : "posts";
  return `/og/${dir}/${slug}.png`;
};
