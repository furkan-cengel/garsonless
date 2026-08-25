import type { MetadataRoute } from 'next'
import { canRestaurantUseFeature, listPublishedPublicMenuSitemapEntries } from '@garsonless/db/server'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = (process.env.NEXT_PUBLIC_MENU_URL ?? 'https://menu.masabu.co').replace(/\/$/, '')
  const entries = await listPublishedPublicMenuSitemapEntries()
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
  return allowed.flatMap(({ entry, allowed: isAllowed }) => isAllowed ? [{
    url: `${origin}/${encodeURIComponent(entry.slug)}`,
    lastModified: new Date(entry.updatedAt),
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }] : [])
}
