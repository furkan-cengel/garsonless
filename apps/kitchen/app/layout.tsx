import type { Metadata } from 'next'
import { FocusModalityScript } from '@garsonless/ui/focus-modality'
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
  robots: { index: false, follow: false, noarchive: true },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <head>
        <FocusModalityScript />
      </head>
      <body className="bg-background text-text antialiased">{children}</body>
    </html>
  )
}
