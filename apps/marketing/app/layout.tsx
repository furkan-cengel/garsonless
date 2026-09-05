import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { FocusModalityScript } from '@garsonless/ui/focus-modality'
import { normalizeWebVitalsSampleRate } from '@garsonless/application/web-vitals'
import WebVitalsReporter from '../components/WebVitalsReporter'
import './globals.css'

const geist = localFont({ src: '../../../assets/fonts/Geist-Latin.woff2', variable: '--font-geist', display: 'swap', weight: '100 900' })
const geistMono = localFont({ src: '../../../assets/fonts/Geist-Mono-Latin.woff2', variable: '--font-geist-mono', display: 'swap', preload: false, weight: '100 900' })
const fraunces = localFont({ src: '../../../assets/fonts/Fraunces-Latin.woff2', variable: '--font-fraunces', display: 'swap', weight: '300 800' })
const pacifico = localFont({ src: '../../../assets/fonts/Pacifico-Latin.woff2', variable: '--font-pacifico', display: 'swap', preload: false, weight: '400' })

export const metadata: Metadata = {
  metadataBase: new URL('https://masabu.co'),
  title: 'masabu — Kafenizi 2 dakikada akıllandırın',
  description: 'QR menü, sipariş yönetimi, mutfak ekranı ve tahsilat araçlarını tek akışta birleştiren restoran yönetim platformu.',
  icons: {
    icon: [
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon.ico' },
    ],
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
  openGraph: {
    title: 'masabu — Kafenizi 2 dakikada akıllandırın',
    description: 'QR menü, sipariş yönetimi, mutfak ekranı ve tahsilat araçlarını tek akışta birleştiren restoran yönetim platformu.',
    url: 'https://masabu.co',
    siteName: 'masabu',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
    locale: 'tr_TR',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <head>
        <FocusModalityScript />
      </head>
      <body className={`${geist.variable} ${geistMono.variable} ${fraunces.variable} ${pacifico.variable}`}>
        <WebVitalsReporter sampleRate={normalizeWebVitalsSampleRate(process.env['MARKETING_WEB_VITALS_SAMPLE_RATE'])} />
        {children}
      </body>
    </html>
  )
}
