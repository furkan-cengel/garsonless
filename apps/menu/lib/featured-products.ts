import { unstable_cache } from 'next/cache'
import {
  readFeaturedProductRanking,
  type FeaturedProductRanking,
} from '@garsonless/application/featured-products'
import { createFeaturedProductsReadPort } from '@garsonless/db/server'
import type { MenuItem } from '@garsonless/ui'

const readCachedRanking = unstable_cache(
  async (restaurantId: string, timeZone: string): Promise<FeaturedProductRanking> => {
    const result = await readFeaturedProductRanking(
      { restaurantId, timeZone },
      createFeaturedProductsReadPort(),
    )
    if (!result.ok) {
      console.error('[featured-products] ranking unavailable', {
        restaurantId,
        error: result.error,
      })
      return { source: 'catalog', productIds: [], quantities: {} }
    }
    return result.value
  },
  ['public-menu-featured-products-v1'],
  { revalidate: 300 },
)

export function getFeaturedProductRanking(restaurantId: string, timeZone: string) {
  return readCachedRanking(restaurantId, timeZone)
}

export function applyFeaturedProductRanking(
  items: MenuItem[],
  ranking: FeaturedProductRanking,
): MenuItem[] {
  const rankById = new Map(ranking.productIds.map((id, index) => [id, index]))
  return items.map((item) => {
    const featuredRank = rankById.get(item.id)
    if (featuredRank === undefined) return item
    return {
      ...item,
      featuredRank,
      featuredSalesQuantity: ranking.quantities[item.id] ?? 0,
      ...(ranking.source !== 'catalog'
        ? { featuredSalesSource: ranking.source }
        : {}),
    }
  })
}
