import { authorAvatarUrl } from "./id-avatar.ts";

export const parseMarkdownLink = (link: string) => {
  const match = /^\s*\[([^\]]+)\]\((.*?)\)\s*$/.exec(link);
  const author = (match?.[1] ?? link).trim() || "Unknown";
  const image = match?.[2]?.trim();
  return {
    author,
    avatarUrl:
      image && /^https?:\/\//i.test(image) ? image : authorAvatarUrl(author),
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
