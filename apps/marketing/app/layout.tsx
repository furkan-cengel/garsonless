import { MarketingAnalytics } from '../components/MarketingAnalytics'
import type { Metadata } from 'next'
import { marketingMetadata, SITE_TITLE, SITE_DESCRIPTION } from '../lib/seo'
import localFont from 'next/font/local'
import { FocusModalityScript } from '@garsonless/ui/focus-modality'
import { normalizeWebVitalsSampleRate } from '@garsonless/application/web-vitals'
import WebVitalsReporter from '../components/WebVitalsReporter'
import './globals.css'

const geist = localFont({ src: '../../../assets/fonts/Geist-Latin.woff2', variable: '--font-geist', display: 'swap', weight: '100 900' })
export const metadata: Metadata = {
  metadataBase: new URL('https://masabu.co'),
  ...marketingMetadata({ title: SITE_TITLE, description: SITE_DESCRIPTION, canonical: '/' }),
  icons: {
    icon: [
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon.ico' },
    ],
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',

}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <head>
        <FocusModalityScript />
      </head>
      <body className={geist.variable}>
        <WebVitalsReporter sampleRate={normalizeWebVitalsSampleRate(process.env['MARKETING_WEB_VITALS_SAMPLE_RATE'])} />
        <MarketingAnalytics />
        {children}
      </body>
    </html>
  )
}
