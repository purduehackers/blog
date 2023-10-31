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
    src,
    alt,
    ...props
  }: Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'> & {
    src?: string
    alt?: string
  }) => {
    const optimized = /(jpe?g|png)$/.test(src || '')
    if (optimized) {
      const file = require(`./public${src}`).default
      return (
        <Image
          {...props}
          src={file}
          blurDataURL={file.blurDataURL}
          alt={alt || ''}
          placeholder="blur"
          width={file.width}
          height={file.height}
          sizes="(max-width: 768px) 100vw, 672px"
          style={{ borderRadius: '8px' }}
        />
      )
    } else {
      return <img src={src} alt={alt} style={{ borderRadius: '8px' }} />
    }
  },
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
