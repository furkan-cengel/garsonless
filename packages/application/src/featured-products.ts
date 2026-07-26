import type { Result } from '@garsonless/domain'
import { ok } from '@garsonless/domain'

export type FeaturedProductSalesSource = 'today' | 'previous-day' | 'catalog'

export interface FeaturedProductOrderRow {
  status: string
  items: unknown
}

export interface FeaturedProductSalesWindows {
  today: FeaturedProductOrderRow[]
  previousDay: FeaturedProductOrderRow[]
}

export interface FeaturedProductsReadPort {
  readSalesWindows(input: {
    restaurantId: string
    timeZone: string
    now: string
  }): Promise<Result<FeaturedProductSalesWindows>>
}

export interface FeaturedProductRanking {
  source: FeaturedProductSalesSource
  productIds: string[]
  quantities: Record<string, number>
}

interface ProductSalesTotal {
  itemId: string
  quantity: number
  gross: number
  firstSeen: number
}

function finiteNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function readOrderLine(value: unknown): { itemId: string; quantity: number; gross: number } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  const rawItemId = row['itemId'] ?? row['item_id']
  const itemId = typeof rawItemId === 'string' ? rawItemId.trim() : ''
  if (!itemId) return null

  const quantity = Math.max(1, Math.floor(finiteNumber(row['quantity'] ?? row['qty'], 1)))
  const unitPrice = Math.max(0, finiteNumber(row['price'] ?? row['unitPrice']))
  return { itemId, quantity, gross: unitPrice * quantity }
}

/**
 * Product popularity is deliberately quantity based: one order with five units
 * outranks one order with a single expensive unit. Gross sales is only a stable
 * tie-breaker. Cancelled rows are ignored defensively even though the DB port
 * also excludes them.
 */
export function rankFeaturedProducts(rows: FeaturedProductOrderRow[]): FeaturedProductRanking {
  const totals = new Map<string, ProductSalesTotal>()
  let firstSeen = 0

  for (const order of rows) {
    if (order.status === 'cancelled' || !Array.isArray(order.items)) continue
    for (const rawLine of order.items) {
      const line = readOrderLine(rawLine)
      if (!line) continue
      const current = totals.get(line.itemId)
      if (current) {
        current.quantity += line.quantity
        current.gross += line.gross
      } else {
        totals.set(line.itemId, {
          itemId: line.itemId,
          quantity: line.quantity,
          gross: line.gross,
          firstSeen: firstSeen++,
        })
      }
    }
  }

  const ranked = [...totals.values()].sort((left, right) =>
    right.quantity - left.quantity
    || right.gross - left.gross
    || left.firstSeen - right.firstSeen
    || left.itemId.localeCompare(right.itemId),
  )

  return {
    source: ranked.length > 0 ? 'today' : 'catalog',
    productIds: ranked.map((row) => row.itemId),
    quantities: Object.fromEntries(ranked.map((row) => [row.itemId, row.quantity])),
  }
}

export function selectFeaturedProductRanking(
  windows: FeaturedProductSalesWindows,
): FeaturedProductRanking {
  const today = rankFeaturedProducts(windows.today)
  if (today.productIds.length > 0) return today

  const previousDay = rankFeaturedProducts(windows.previousDay)
  return previousDay.productIds.length > 0
    ? { ...previousDay, source: 'previous-day' }
    : previousDay
}

export async function readFeaturedProductRanking(
  input: { restaurantId: string; timeZone: string; now?: Date },
  port: FeaturedProductsReadPort,
): Promise<Result<FeaturedProductRanking>> {
  const windows = await port.readSalesWindows({
    restaurantId: input.restaurantId,
    timeZone: input.timeZone,
    now: (input.now ?? new Date()).toISOString(),
  })
  return windows.ok ? ok(selectFeaturedProductRanking(windows.value)) : windows
}
