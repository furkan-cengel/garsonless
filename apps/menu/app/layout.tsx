import type { Metadata } from 'next'
import './globals.css'
import PreviewInjector from '../components/PreviewInjector'

export const metadata: Metadata = {
  title: 'Menu',
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
