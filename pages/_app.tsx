import '../styles/globals.css'
import type { AppProps } from 'next/app'
import Head from 'next/head'
import { GeistMono } from 'geist/font'
import { IBM_Plex_Serif } from 'next/font/google'
import { Analytics } from '@vercel/analytics/react'

const ibmPlexSerif = IBM_Plex_Serif({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-ibm-plex-serif'
})

function MyApp({ Component, pageProps }: AppProps) {
  const vercelEnv = process.env.NEXT_PUBLIC_VERCEL_ENV
  return (
    <>
      <Head>
        <meta name="theme-color" content="#D97706" />
        <link
          rel="icon"
          href={
            vercelEnv === 'production'
              ? '/favicon.ico'
              : vercelEnv === 'preview'
              ? '/favicon_preview.ico'
              : '/favicon_dev.ico'
          }
        />
      </Head>
      <main className={`${GeistMono.variable} ${ibmPlexSerif.variable}`}>
        <Component {...pageProps} />
      </main>
      <Analytics />
    </>
  )
}

export default MyApp
