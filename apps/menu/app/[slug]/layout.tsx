import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { applyGarsonlessTheme, buildFontsUrlFromTheme } from '@garsonless/design-engine'
import { getRestaurantBySlug, getThemeConfig } from '../../lib/queries'
import { resolveMenuTheme } from '../../lib/resolve-theme'

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

  const themeConfig = await getThemeConfig(restaurant.id)
  // Resolve identically to page.tsx so the SSR <style> matches the client's
  // initialTheme (no first-load color flash). Layouts can't read searchParams,
  // so the SSR style uses the saved active template; a preview `?template=`
  // override is a client-only concern handled by the (opacity-gated) editor iframe.
  const { theme } = resolveMenuTheme({
    settings: restaurant.settings as Record<string, unknown> | null,
    themeTokens: themeConfig?.tokens,
  })

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
