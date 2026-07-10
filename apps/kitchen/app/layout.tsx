import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Masabu Kitchen',
  description: 'Kitchen Display System',
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
      <body className="bg-background text-text antialiased">{children}</body>
    </html>
  )
}
