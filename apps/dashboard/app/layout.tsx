import type { Metadata } from 'next'
import './globals.css'
import spinnerStyles from '@garsonless/ui/spinners/styles'

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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,ital,wght@9..144,0..1,300..800&family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600;700&family=Pacifico&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={spinnerStyles.scope} style={{ fontFamily: "'Geist', system-ui, -apple-system, sans-serif" }}>{children}</body>
    </html>
  )
}
