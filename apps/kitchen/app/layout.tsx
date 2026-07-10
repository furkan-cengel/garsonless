import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Masabu Kitchen',
  description: 'Kitchen Display System',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="bg-background text-text antialiased">{children}</body>
    </html>
  )
}
