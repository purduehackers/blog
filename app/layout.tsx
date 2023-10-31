import '../styles/globals.css'
import type { PropsWithChildren } from 'react'
import { Analytics } from '@vercel/analytics/react'
import { Metadata, Viewport } from 'next'
import { GeistMono } from 'geist/font'
import { Space_Grotesk, IBM_Plex_Serif } from 'next/font/google'

const SpaceGrotesk = Space_Grotesk({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-space-grotesk'
})
const IBMPlexSerif = IBM_Plex_Serif({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-ibm-plex-serif',
  display: 'swap'
})

const images = [
  'https://og.purduehackers.com/Blog.png?theme=light&md=1&fontSize=250px&caption='
]

export const metadata: Metadata = {
  metadataBase: new URL('https://blog.purduehackers.com'),
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
  }
}

export const viewport: Viewport = {
  themeColor: '#D97706'
}

export default function Layout({ children }: PropsWithChildren<{}>) {
  return (
    <html
      lang="en-US"
      className={`${GeistMono.variable} ${SpaceGrotesk.variable} ${IBMPlexSerif.variable}`}
    >
      <head />
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
