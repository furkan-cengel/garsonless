import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { applyGarsonlessTheme } from '@garsonless/design-engine'
import { getRestaurantBySlug } from '../../lib/queries'
import { getPublishedTheme } from '../../lib/published-theme'
import { menuSearchMetadata } from '../../lib/search-metadata'

interface Props {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  return menuSearchMetadata((await params).slug)
}

export default async function SlugLayout({ children, params }: Props) {
  const { slug } = await params
  const restaurant = await getRestaurantBySlug(slug)
  if (!restaurant) notFound()

  const themeResult = await getPublishedTheme(restaurant.id)
  if (!themeResult.ok) notFound()
  // Resolve identically to page.tsx so the SSR <style> matches the client's
  // initialTheme (no first-load color flash). Masabu exposes one canonical menu
  // template; the editor changes its tokens instead of swapping renderers.
  const { theme } = themeResult.value

  const themeCSS = applyGarsonlessTheme(theme)
  const origin = (process.env.NEXT_PUBLIC_MENU_URL ?? 'http://localhost:3011').replace(/\/$/, '')
  const structuredData = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: restaurant.name,
    url: `${origin}/${encodeURIComponent(restaurant.slug)}`,
    ...(restaurant.logo_url ? { image: restaurant.logo_url } : {}),
    hasMenu: `${origin}/${encodeURIComponent(restaurant.slug)}/menu`,
  }).replace(/</g, '\\u003c')

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />
      <style dangerouslySetInnerHTML={{ __html: themeCSS }} />
      {children}
    </>
  )
}
