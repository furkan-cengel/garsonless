import { cache } from 'react'
import type { Metadata } from 'next'
import { getRestaurantBySlug } from './queries'
import { getPublishedTheme } from './published-theme'
import { resolveHomeOpenGraphImage } from './home-metadata'
import { hasIndexableStorefront, isRestaurantIndexable, menuCanonicalPath } from './search-indexing'

const readMenuSearchContext = cache(async (slug: string) => {
  const restaurant = await getRestaurantBySlug(slug)
  if (!restaurant) return null
  const published = await getPublishedTheme(restaurant.id)
  if (!published.ok) return null
  const theme = published.value.theme
  const storefront = hasIndexableStorefront(theme.surfaces?.home.enabled === true,
    process.env['THEME_EXPERIENCE_V2_ENABLED'] === 'true' || process.env.NODE_ENV === 'development')
  return { restaurant, theme, storefront }
})

export async function menuSearchMetadata(slug: string, isMenu = false): Promise<Metadata> {
  const context = await readMenuSearchContext(slug)
  if (!context) return { title: 'Menü bulunamadı', robots: { index: false } }
  const { restaurant, theme, storefront } = context
  const origin = (process.env.NEXT_PUBLIC_MENU_URL ?? 'https://menu.masabu.co').replace(/\/$/, '')
  const title = isMenu && storefront ? `${restaurant.name} Menü` : theme.surfaces?.home.seo?.title?.trim() || restaurant.name
  const description = theme.surfaces?.home.seo?.description?.trim() || theme.pageDescription?.trim() || `${restaurant.name} menüsünü ve işletme deneyimini keşfedin.`
  const url = origin + menuCanonicalPath(slug, isMenu, storefront)
  const image = resolveHomeOpenGraphImage(theme)
  return {
    title, description, alternates: { canonical: url },
    robots: { index: isRestaurantIndexable(restaurant.id), follow: true },
    openGraph: { title, description, type: 'website', url, ...(image ? { images: [image] } : {}) },
  }
}
