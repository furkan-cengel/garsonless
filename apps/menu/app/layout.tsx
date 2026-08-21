import type { Metadata, Viewport } from 'next'
import { FocusModalityScript } from '@garsonless/ui/focus-modality'
import './globals.css'

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
      <body className="bg-background text-text antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
