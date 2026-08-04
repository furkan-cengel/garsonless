import type { Metadata } from 'next'
import { Fraunces, Geist, Geist_Mono, Pacifico } from 'next/font/google'
import './globals.css'
import spinnerStyles from '@garsonless/ui/spinners/styles'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist', display: 'swap' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono', display: 'swap' })
const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces', display: 'swap' })
const pacifico = Pacifico({ subsets: ['latin'], weight: '400', variable: '--font-pacifico', display: 'swap' })

export const metadata: Metadata = {
  title: 'Masabu — QR Menü & Dijital Sipariş',
  description:
    'Restoranınızı modernleştirin. QR menü, dijital sipariş, mutfak ekranı ve analitik — 5 dakikada kurulum.',
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
      <body
        className={`${spinnerStyles.scope} ${geist.variable} ${geistMono.variable} ${fraunces.variable} ${pacifico.variable}`}
        style={{ fontFamily: geist.style.fontFamily }}
      >
        {children}
      </body>
    </html>
  )
}
