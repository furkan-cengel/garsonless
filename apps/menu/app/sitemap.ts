import { hasIndexableStorefront, isRestaurantIndexable, menuCanonicalPath } from '../lib/search-indexing'
import type { MetadataRoute } from 'next'
import { canRestaurantUseFeature, listPublishedPublicMenuSitemapEntries } from '@garsonless/db/server'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = (process.env.NEXT_PUBLIC_MENU_URL ?? 'https://menu.masabu.co').replace(/\/$/, '')
  const entries = (await listPublishedPublicMenuSitemapEntries()).filter((entry) => isRestaurantIndexable(entry.restaurantId))
  const allowed: Array<{ entry: (typeof entries)[number]; allowed: boolean }> = []
  for (let index = 0; index < entries.length; index += 20) {
    const batch = entries.slice(index, index + 20)
    allowed.push(...await Promise.all(batch.map(async (entry) => ({
      entry,
      allowed: await canRestaurantUseFeature({
        restaurantId: entry.restaurantId,
        plan: entry.plan,
        feature: 'qr_menu',
      }),
    }))))
  }
  const experienceEnabled = process.env['THEME_EXPERIENCE_V2_ENABLED'] === 'true' || process.env.NODE_ENV === 'development'
  return allowed.flatMap(({ entry, allowed: isAllowed }) => {
    if (!isAllowed) return []
    const storefront = hasIndexableStorefront(entry.homeEnabled, experienceEnabled)
    return (storefront ? [false, true] : [false]).map((isMenu) => ({
      url: origin + menuCanonicalPath(entry.slug, isMenu, storefront),
      lastModified: new Date(entry.updatedAt),
    }))
  })
}
