import { createElement, type ComponentProps } from "react";

type HeadingProps = ComponentProps<"h2">;
type ImageProps = ComponentProps<"img">;

const ArticleImage = ({
  className = "",
  alt = "",
  loading = "lazy",
  ...props
}: ImageProps) => (
  <a
    href={props.src}
    data-fancybox="post"
    data-caption={alt || undefined}
    className="article-image"
  >
    <img
      {...props}
      alt={alt}
      loading={loading}
      decoding="async"
      className={className}
    />
  </a>
);

const proseComponents = {
  p: (props: ComponentProps<"p">) => (
    <p {...props} className={`article-paragraph ${props.className ?? ""}`} />
  ),
  a: ({ target, rel, ...props }: ComponentProps<"a">) => {
    const isExternal = /^https?:\/\//i.test(props.href ?? "");
    return (
      <a
        {...props}
        target={target ?? (isExternal ? "_blank" : undefined)}
        rel={rel ?? (isExternal ? "noopener noreferrer" : undefined)}
      />
    );
  },
  img: ArticleImage,
  WideImage: ArticleImage,
  ul: (props: ComponentProps<"ul">) => (
    <ul {...props} className={`article-list ${props.className ?? ""}`} />
  ),
  ol: (props: ComponentProps<"ol">) => (
    <ol {...props} className={`article-list ${props.className ?? ""}`} />
  ),
  li: (props: ComponentProps<"li">) => <li {...props} />,
  hr: (props: ComponentProps<"hr">) => (
    <hr {...props} className={`article-rule ${props.className ?? ""}`} />
  ),
  blockquote: (props: ComponentProps<"blockquote">) => (
    <blockquote
      {...props}
      className={`article-quote ${props.className ?? ""}`}
    />
  ),
};

export default function createArticleComponents(headings: { depth: number }[]) {
  // Start content at h2 whether the source begins with # or ##. Preserve IDs.
  const shift = 2 - Math.min(...headings.map(({ depth }) => depth), 2);
  const heading = (level: number) => (props: HeadingProps) =>
    createElement(`h${Math.min(6, level + shift)}`, {
      ...props,
      "data-article-heading": "",
    });
  return {
    ...proseComponents,
    h1: heading(1),
    h2: heading(2),
    h3: heading(3),
    h4: heading(4),
    h5: heading(5),
    h6: heading(6),
  };
}
