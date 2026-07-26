import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { readPublishedTheme } from '@garsonless/application/themes'
import { createThemeApplicationPort } from '@garsonless/db/server'
import { applyGarsonlessTheme, buildFontsUrlFromTheme } from '@garsonless/design-engine'
import { getRestaurantBySlug } from '../../lib/queries'

interface Props {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const restaurant = await getRestaurantBySlug(slug)
  return { title: restaurant?.name ?? 'Menu' }
}

export default async function SlugLayout({ children, params }: Props) {
  const { slug } = await params
  const restaurant = await getRestaurantBySlug(slug)
  if (!restaurant) notFound()

  const themeResult = await readPublishedTheme({ restaurantId: restaurant.id }, createThemeApplicationPort())
  if (!themeResult.ok) notFound()
  // Resolve identically to page.tsx so the SSR <style> matches the client's
  // initialTheme (no first-load color flash). Masabu exposes one canonical menu
  // template; the editor changes its tokens instead of swapping renderers.
  const { theme } = themeResult.value

  const themeCSS = applyGarsonlessTheme(theme)
  const fontsUrl = buildFontsUrlFromTheme(theme)

  return (
    <>
      {fontsUrl && (
        <>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link rel="stylesheet" href={fontsUrl} precedence="default" />
        </>
      )}
      <style dangerouslySetInnerHTML={{ __html: themeCSS }} />
      {children}
    </>
  )
}
