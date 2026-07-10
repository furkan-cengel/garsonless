import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://masabu.co'),
  title: 'masabu — Kafenizi 2 dakikada akıllandırın',
  description: 'QR menü, sipariş yönetimi, mutfak ekranı ve daha fazlası. 2 dakikada kurulum, garson maliyeti sıfır.',
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
    description: 'QR menü, sipariş yönetimi, mutfak ekranı ve daha fazlası. 2 dakikada kurulum, garson maliyeti sıfır.',
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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800&family=Geist+Mono:wght@400;500&family=Fraunces:ital,wght@0,400;0,500;0,600;0,700;1,500;1,600&family=Pacifico&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
