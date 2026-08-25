import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { FocusModalityScript } from '@garsonless/ui/focus-modality'
import './globals.css'

const geist = localFont({ src: '../../../assets/fonts/Geist.ttf', variable: '--font-geist', display: 'swap', weight: '100 900' })
const geistMono = localFont({ src: '../../../assets/fonts/Geist-Mono.ttf', variable: '--font-geist-mono', display: 'swap', weight: '100 900' })

export const metadata: Metadata = {
  title: 'Masabu Platform',
  description: 'Masabu platform operations control plane',
  robots: { index: false, follow: false, noarchive: true },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      <head>
        <FocusModalityScript />
      </head>
      <body className={`${geist.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  )
}
