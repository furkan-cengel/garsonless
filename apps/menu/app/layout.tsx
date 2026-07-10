import type { Metadata } from 'next'
import './globals.css'
import PreviewInjector from '../components/PreviewInjector'

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      {/* suppressHydrationWarning: browser extensions (antivirus etc.) inject
          attributes into <body> before React hydrates — not our markup. */}
      <body className="bg-background text-text antialiased" suppressHydrationWarning>
        <PreviewInjector />
        {children}
      </body>
    </html>
  )
}
