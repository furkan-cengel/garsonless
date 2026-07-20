import { cache } from 'react'
import {
  normalizeTimeZone,
  rangeWindow,
} from '@garsonless/db/browser'
import {
  createAnalyticsReadModelPort,
  createDashboardInsightsReadModelPort,
} from '@garsonless/db/server'
import type { DashboardInsightsSection } from '@garsonless/application/read-models'
import type { DashboardActorContext } from '@garsonless/domain'
import { assertAccess, getUserRestaurantAccess } from '../auth/access'
import { getRestaurantById } from './restaurants'

export interface DashboardKPIs {
  revenue: number
  revenueYesterday: number
  orders: number
  ordersYesterday: number
  paidOrders: number
  paidOrdersYesterday: number
  activeOrders: number
  avgBasket: number
  sessions: number
  sessionsYesterday: number
}

export interface TopItem {
  name: string
  count: number
  revenue: number
}

export interface TableStatusData {
  id: string
  label: string
  status: 'empty' | 'active' | 'new' | 'late' | 'paid'
  time: number
  total: number
  sessionId: string | null
  openedAt: string | null
  unpaidTotal: number
  splitSettledTotal: number
  splitDeclaredCashTotal: number
  orderCount: number
  hasUnfinished: boolean
}

export const analyticsReadModel = createAnalyticsReadModelPort()
export const insightsReadModel = createDashboardInsightsReadModelPort()

export function isOrderVolumeRow(row: { status?: string | null }) {
  return row.status !== 'cancelled'
}

// Collected revenue is filtered only by the DB adapter, which translates the
// canonical @garsonless/domain/orders specification. Dashboard code receives a
// typed collected projection and cannot hand-build a competing predicate.
export const COMP_METHOD = 'comp'

export const getInsightsContext = cache(async function getInsightsContext(
  restaurantId: string,
  section: DashboardInsightsSection,
): Promise<DashboardActorContext> {
  const [gate, access] = await Promise.all([
    assertAccess(restaurantId, section),
    getUserRestaurantAccess(restaurantId),
  ])
  if ('error' in gate || !access) throw new Error('Not authorized')
  return {
    actor: 'dashboard-member',
    userId: gate.userId,
    restaurantId,
    permissions: access.permissions,
    isOwner: access.isOwner,
  }
})

export function sumTotals(rows: Array<{ total?: number | null }>) {
  return rows.reduce((sum, row) => sum + (row.total ?? 0), 0)
}

export const getRestaurantTimezone = cache(async function getRestaurantTimezone(
  restaurantId: string,
): Promise<string> {
  const restaurant = await getRestaurantById(restaurantId)
  return normalizeTimeZone(restaurant?.timezone)
})

export async function rangeWindowFor(restaurantId: string, range: string) {
  const tz = await getRestaurantTimezone(restaurantId)
  return rangeWindow(tz, range)
}

type AnalyticsOrderItem = {
  itemId?: string
  name?: string
  price?: number
  qty?: number
  quantity?: number
  modifiersPriceDelta?: number
}

export function foldOrderItems(
  rows: Array<{ items?: unknown; created_at?: string }>,
  since?: Date,
) {
  const counts = new Map<string, { count: number; revenue: number }>()

  for (const row of rows) {
    if (since && row.created_at && new Date(row.created_at) < since) continue
    if (!Array.isArray(row.items)) continue

    for (const item of row.items as AnalyticsOrderItem[]) {
      const name = typeof item.name === 'string' && item.name.trim() ? item.name.trim() : 'Ürün'
      const qtyRaw = typeof item.quantity === 'number' ? item.quantity : item.qty
      const qty = typeof qtyRaw === 'number' && Number.isFinite(qtyRaw) && qtyRaw > 0 ? qtyRaw : 1
      const basePrice = typeof item.price === 'number' && Number.isFinite(item.price) ? item.price : 0
      const modifierDelta = typeof item.modifiersPriceDelta === 'number' && Number.isFinite(item.modifiersPriceDelta)
        ? item.modifiersPriceDelta
        : 0
      const unitPrice = Math.max(0, basePrice + modifierDelta)
      const current = counts.get(name) ?? { count: 0, revenue: 0 }
      current.count += qty
      current.revenue += unitPrice * qty
      counts.set(name, current)
    }
  }

  return counts
}

export function emptyKpis(): DashboardKPIs {
  return {
    revenue: 0,
    revenueYesterday: 0,
    orders: 0,
    ordersYesterday: 0,
    paidOrders: 0,
    paidOrdersYesterday: 0,
    activeOrders: 0,
    avgBasket: 0,
    sessions: 0,
    sessionsYesterday: 0,
  }
}
