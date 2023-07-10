import Image from 'next/image'
import { HTMLAttributes, ImgHTMLAttributes } from 'react'

export default {
  h1: ({ ...props }: HTMLAttributes<HTMLHeadingElement>) => (
    <h1 className="font-bold mt-4">{props.children}</h1>
  ),
  h2: ({ ...props }: HTMLAttributes<HTMLHeadingElement>) => (
    <h2 className="font-bold">{props.children}</h2>
  ),
  a: ({ ...props }: HTMLAttributes<HTMLAnchorElement>) => (
    <a
      target="_blank"
      className="text-post hover:text-post-light transition"
      style={{
        textDecoration: 'underline',
        textUnderlineOffset: '4px'
      }}
      {...props}
    ></a>
  ),
  img: ({
    ...props
  }: Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'> & {
    src: string
    alt: string
  }) => (
    <Image
      {...props}
      placeholder="empty"
      width={0}
      height={0}
      sizes="(max-width: 768px) 100vw,
      (max-width: 1024px) 50vw,
      33vw"
      style={{
        width: 'auto',
        height: 'auto',
        borderRadius: '8px'
      }}
    />
  ),
  ul: ({ ...props }: HTMLAttributes<HTMLUListElement>) => (
    <ul className="list-disc list-outside ml-6 sm:ml-0">{props.children}</ul>
  ),
  ol: ({ ...props }: HTMLAttributes<HTMLOListElement>) => (
    <ol className="list-decimal list-inside ml-6">{props.children}</ol>
  ),
  li: ({ ...props }: HTMLAttributes<HTMLLIElement>) => (
    <li className="mb-2">{props.children}</li>
  ),
  hr: () => <hr className="border-2 border-post w-1/2 mx-auto my-4" />
}
