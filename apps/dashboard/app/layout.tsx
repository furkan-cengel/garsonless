import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Masabu — QR Menü & Dijital Sipariş',
  description:
    'Restoranınızı modernleştirin. QR menü, dijital sipariş, mutfak ekranı ve analitik — 5 dakikada kurulum.',
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
      <body style={{ fontFamily: "'Geist', system-ui, -apple-system, sans-serif" }}>{children}</body>
    </html>
  )
}
