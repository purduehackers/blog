import '../styles/globals.css'
import type { PropsWithChildren } from 'react'
import { Analytics } from '@vercel/analytics/react'
import { Metadata } from 'next'
import { GeistMono } from 'geist/font'

const images = [
  'https://og.purduehackers.com/Blog.png?theme=light&md=1&fontSize=250px&caption='
]

export const metadata: Metadata = {
  title: {
    template: '%s | Purdue Hackers',
    default: 'Blog'
  },
  openGraph: {
    siteName: 'Purdue Hackers',
    type: 'website',
    locale: 'en_US',
    images
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Purdue Hackers',
    creator: '@purduehackers',
    images
  },
  themeColor: '#D97706'
}

export default function Layout({ children }: PropsWithChildren<{}>) {
  return (
    <html lang="en-US" className={`${GeistMono.variable}`}>
      <head />
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
