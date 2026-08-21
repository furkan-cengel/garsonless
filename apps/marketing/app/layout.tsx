import type { Metadata } from 'next'
import { Fraunces, Geist, Geist_Mono, Pacifico } from 'next/font/google'
import { FocusModalityScript } from '@garsonless/ui/focus-modality'
import './globals.css'

const reloadScrollReset = `
(() => {
  const navigation = performance.getEntriesByType('navigation')[0];
  if (!navigation || navigation.type !== 'reload') return;

  const canControlRestoration = 'scrollRestoration' in history;
  if (canControlRestoration) history.scrollRestoration = 'manual';

  const resetScroll = () => {
    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      requestAnimationFrame(() => {
        if (canControlRestoration) history.scrollRestoration = 'auto';
      });
    });
  };

  if (document.readyState === 'complete') resetScroll();
  else window.addEventListener('load', resetScroll, { once: true });
})();
`

const geist = Geist({ subsets: ['latin'], variable: '--font-geist', display: 'swap' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono', display: 'swap' })
const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces', display: 'swap' })
const pacifico = Pacifico({ subsets: ['latin'], weight: '400', variable: '--font-pacifico', display: 'swap' })

export const metadata: Metadata = {
  metadataBase: new URL('https://masabu.co'),
  title: 'masabu — Kafenizi 2 dakikada akıllandırın',
  description: 'QR menü, sipariş yönetimi, mutfak ekranı ve tahsilat araçlarını tek akışta birleştiren restoran yönetim platformu.',
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
    description: 'QR menü, sipariş yönetimi, mutfak ekranı ve tahsilat araçlarını tek akışta birleştiren restoran yönetim platformu.',
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
        <FocusModalityScript />
        <script dangerouslySetInnerHTML={{ __html: reloadScrollReset }} />
      </head>
      <body className={`${geist.variable} ${geistMono.variable} ${fraunces.variable} ${pacifico.variable}`}>{children}</body>
    </html>
  )
}
