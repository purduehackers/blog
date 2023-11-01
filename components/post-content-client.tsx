'use client'

// This component was created entirely because of the lightning time post
// i feel like there's gotta be a better way to do this but idk how

import { getMDXComponent } from 'next-contentlayer/hooks'
import components from '@/mdx-components'

function PostContentClient({
  rawContent
}: {
  rawContent: string
}): JSX.Element {
  const Content = getMDXComponent(rawContent)
  return (
    <article className="mt-8 sm:mt-12 mb-12 sm:mb-16 text-lg font-serif flex flex-col items-start gap-y-4 justify-center w-11/12 sm:w-full max-w-2xl mx-auto">
      <Content components={components} />
    </article>
  )
}

export default PostContentClient
