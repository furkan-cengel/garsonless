import type {
  FeaturedProductOrderRow,
  FeaturedProductsReadPort,
} from '@garsonless/application/featured-products'
import { err, ok } from '@garsonless/domain'
import { createServiceClient } from './client'
import { normalizeTimeZone, startOfDayNDaysAgo, startOfRestaurantDay } from './restaurant-time'

const PAGE_SIZE = 1_000
const MAX_ROWS = 10_000

type FeaturedOrderRow = {
  status: string
  items: unknown
  created_at: string
}

export function createFeaturedProductsReadPort(): FeaturedProductsReadPort {
  return {
    async readSalesWindows({ restaurantId, timeZone, now }) {
      const instant = new Date(now)
      if (Number.isNaN(instant.getTime())) return err('Invalid featured-products clock')

      const zone = normalizeTimeZone(timeZone)
      const todayStart = startOfRestaurantDay(zone, instant)
      const previousDayStart = startOfDayNDaysAgo(zone, 1, instant)
      const supabase = createServiceClient()
      const rows: FeaturedOrderRow[] = []

      for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
        const { data, error } = await supabase
          .from('orders')
          .select('status, items, created_at')
          .eq('restaurant_id', restaurantId)
          .gte('created_at', previousDayStart.toISOString())
          .lt('created_at', instant.toISOString())
          .neq('status', 'cancelled')
          .is('deleted_at', null)
          .order('created_at', { ascending: true })
          .range(from, from + PAGE_SIZE - 1)

        if (error) return err(`Failed to read featured products: ${error.message}`)
        const page = (data ?? []) as FeaturedOrderRow[]
        rows.push(...page)
        if (page.length < PAGE_SIZE) break
      }

      if (rows.length === MAX_ROWS) {
        console.warn('[featured-products] order window reached safety limit', {
          restaurantId,
          maxRows: MAX_ROWS,
        })
      }

      const today: FeaturedProductOrderRow[] = []
      const previousDay: FeaturedProductOrderRow[] = []
      for (const row of rows) {
        const target = new Date(row.created_at).getTime() >= todayStart.getTime()
          ? today
          : previousDay
        target.push({ status: row.status, items: row.items })
      }

      return ok({ today, previousDay })
    },
  }
}
