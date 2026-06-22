import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { applyGarsonlessTheme, buildFontsUrlFromTheme, DEFAULT_THEME } from '@garsonless/design-engine'
import type { GarsonlessTheme } from '@garsonless/design-engine'
import { getRestaurantBySlug, getThemeConfig } from '../../lib/queries'

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
  const raw = themeConfig?.tokens as unknown
  const theme: GarsonlessTheme =
    raw != null && typeof raw === 'object' && 'bg' in (raw as object)
      ? (raw as GarsonlessTheme)
      : DEFAULT_THEME

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
