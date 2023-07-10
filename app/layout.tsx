import '../styles/globals.css'
import type { PropsWithChildren } from 'react'
import { Analytics } from '@vercel/analytics/react'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    template: '%s | Purdue Hackers',
    default: 'Blog'
  },
  themeColor: '#D97706'
}

export default function Layout({ children }: PropsWithChildren<{}>) {
  return (
    <html lang="en-US">
      <head />
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
