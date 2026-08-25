import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import { FocusModalityScript } from '@garsonless/ui/focus-modality'
import { normalizeWebVitalsSampleRate } from '@garsonless/application/web-vitals'
import WebVitalsReporter from '../components/WebVitalsReporter'
import './globals.css'

const dmSans = localFont({ src: '../../../assets/fonts/DM-Sans.ttf', variable: '--font-dm-sans', display: 'swap', weight: '300 800' })
const fraunces = localFont({ src: '../../../assets/fonts/Fraunces.ttf', variable: '--font-fraunces', display: 'swap', weight: '300 800' })
const fredoka = localFont({ src: '../../../assets/fonts/Fredoka.ttf', variable: '--font-fredoka', display: 'swap', weight: '300 700' })
const inter = localFont({ src: '../../../assets/fonts/Inter.ttf', variable: '--font-inter', display: 'swap', weight: '300 800' })
const manrope = localFont({ src: '../../../assets/fonts/Manrope.ttf', variable: '--font-manrope', display: 'swap', weight: '300 800' })
const nunito = localFont({ src: '../../../assets/fonts/Nunito.ttf', variable: '--font-nunito', display: 'swap', weight: '300 800' })
const pacifico = localFont({ src: '../../../assets/fonts/Pacifico.ttf', variable: '--font-pacifico', display: 'swap', weight: '400' })
const playfair = localFont({ src: '../../../assets/fonts/Playfair-Display.ttf', variable: '--font-playfair', display: 'swap', weight: '400 800' })
const themeFontVariables = [dmSans, fraunces, fredoka, inter, manrope, nunito, pacifico, playfair]
  .map((font) => font.variable)
  .join(' ')

export const metadata: Metadata = {
  title: 'Menu',
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

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <head>
        <FocusModalityScript />
      </head>
      {/* suppressHydrationWarning: browser extensions (antivirus etc.) inject
          attributes into <body> before React hydrates — not our markup. */}
      <body className={`${themeFontVariables} bg-background text-text antialiased`} suppressHydrationWarning>
        <WebVitalsReporter sampleRate={normalizeWebVitalsSampleRate(process.env['MENU_WEB_VITALS_SAMPLE_RATE'])} />
        {children}
      </body>
    </html>
  )
}
