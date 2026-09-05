import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { FocusModalityScript } from '@garsonless/ui/focus-modality'
import { normalizeWebVitalsSampleRate } from '@garsonless/application/web-vitals'
import WebVitalsReporter from '../components/WebVitalsReporter'
import './globals.css'

const geist = localFont({ src: '../../../assets/fonts/Geist-Latin.woff2', variable: '--font-geist', display: 'swap', weight: '100 900' })
const geistMono = localFont({ src: '../../../assets/fonts/Geist-Mono-Latin.woff2', variable: '--font-geist-mono', display: 'swap', preload: false, weight: '100 900' })
const fraunces = localFont({
  src: '../../../assets/fonts/Fraunces-Latin.woff2', variable: '--font-fraunces',
  display: 'swap', preload: false, weight: '300 800',
  // The full face serves only characters outside the primary subset; ordinary
  // Turkish text must not download both files during the font swap period.
  declarations: [{ prop: 'unicode-range', value: 'U+0100-011D,U+0120-012F,U+0132-015D,U+0160-1FFF,U+2070-209F,U+20D0-218F,U+2200-10FFFF' }],
})
const frauncesPrimary = localFont({
  src: '../../../assets/fonts/Fraunces-Latin-TR.woff2', variable: '--font-fraunces-primary',
  display: 'swap', weight: '300 800',
  // Keep Next's system fallback from masking the full Latin face for glyphs
  // outside this subset. The full face supplies the final adjusted fallback.
  adjustFontFallback: false,
})
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
      <body className={`${geist.variable} ${geistMono.variable} ${frauncesPrimary.variable} ${fraunces.variable} ${pacifico.variable}`}>
        <WebVitalsReporter sampleRate={normalizeWebVitalsSampleRate(process.env['MARKETING_WEB_VITALS_SAMPLE_RATE'])} />
        {children}
      </body>
    </html>
  )
}
