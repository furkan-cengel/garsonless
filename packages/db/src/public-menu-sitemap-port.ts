import { createServiceClient } from './service-client'

export type PublicMenuSitemapEntry = {
  restaurantId: string
  slug: string
  name: string
  logoUrl: string | null
  plan: string
  updatedAt: string
}

/** Service-only projection: no owner, settings, billing, or contact PII. */
export async function listPublishedPublicMenuSitemapEntries(): Promise<PublicMenuSitemapEntry[]> {
  const { data, error } = await createServiceClient()
    .from('theme_configs')
    .select('published_at, restaurants!inner(id, slug, name, logo_url, plan, updated_at, deleted_at)')
    .is('restaurants.deleted_at', null)
    .order('published_at', { ascending: false })
    .limit(50_000)
  if (error) throw error
  return (data ?? []).flatMap((row) => {
    const restaurant = row.restaurants as unknown as {
      id: string
      slug: string
      name: string
      logo_url: string | null
      plan: string
      updated_at: string
      deleted_at: string | null
    }
    if (!restaurant || restaurant.deleted_at || !restaurant.slug) return []
    return [{
      restaurantId: restaurant.id,
      slug: restaurant.slug,
      name: restaurant.name,
      logoUrl: restaurant.logo_url,
      plan: restaurant.plan,
      updatedAt: row.published_at > restaurant.updated_at ? row.published_at : restaurant.updated_at,
    }]
  })
}
