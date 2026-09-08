import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'
import spinnerStyles from '@garsonless/ui/spinners/styles'
import { FocusModalityScript } from '@garsonless/ui/focus-modality'
import { TooltipProvider } from '@/components/ui/tooltip'

const geist = localFont({ src: '../../../assets/fonts/Geist.ttf', variable: '--font-geist', display: 'swap', weight: '100 900' })
const geistMono = localFont({ src: '../../../assets/fonts/Geist-Mono.ttf', variable: '--font-geist-mono', display: 'swap', weight: '100 900' })
const fraunces = localFont({ src: '../../../assets/fonts/Fraunces.ttf', variable: '--font-fraunces', display: 'swap', weight: '300 800' })
const pacifico = localFont({ src: '../../../assets/fonts/Pacifico.ttf', variable: '--font-pacifico', display: 'swap', weight: '400' })
const nunito = localFont({ src: '../../../assets/fonts/Nunito.ttf', variable: '--font-nunito', display: 'swap', weight: '300 800' })

export const metadata: Metadata = {
  title: 'masabu - QR Menü & Dijital Sipariş',
  description:
    'Restoranınızı modernleştirin. QR menü, dijital sipariş, mutfak ekranı ve analitik - 5 dakikada kurulum.',
  icons: {
    icon: [
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon.ico' },
    ],
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
  robots: { index: false, follow: false, noarchive: true },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <head>
        <FocusModalityScript />
      </head>
      <body
        className={`${spinnerStyles.scope} ${geist.variable} ${geistMono.variable} ${fraunces.variable} ${pacifico.variable} ${nunito.variable}`}
        style={{ fontFamily: geist.style.fontFamily }}
      >
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  )
}
