import { cache } from 'react'
import {
  customRangeWindow,
  normalizeTimeZone,
  rangeWindow,
} from '@garsonless/db/browser'
import {
  createAnalyticsReadModelPort,
  createDashboardInsightsReadModelPort,
} from '@garsonless/db/server'
import {
  readAnalyticsCoreMetrics,
  type DashboardInsightsSection,
} from '@garsonless/application/read-models'
import type { AnalyticsOrderReadFilters } from '@garsonless/application/read-models'
import type { DashboardActorContext } from '@garsonless/domain'
import { assertAccess, getUserRestaurantAccess } from '../auth/access'
import { foldOrderItemsToNet, type AnalyticsFinancialOrder } from '../analytics-financial-model'
import { getRestaurantById } from './restaurants'
import { coerceAnalyticsQuery, type AnalyticsQuery } from '../analytics-filter-contract'

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

/** Period-scoped KPIs for the analytics sales report. Unlike DashboardKPIs,
 * every value here belongs to the selected range or its immediately preceding
 * comparison range; live/today snapshot values are deliberately excluded. */
export interface AnalyticsRangeKPIs {
  revenue: number
  previousRevenue: number
  orders: number
  previousOrders: number
  paidOrders: number
  previousPaidOrders: number
  avgBasket: number
  sessions: number
  previousSessions: number
}

export interface PanoOrderSummary {
  pending: number
  preparing: number
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

export async function rangeWindowFor(restaurantId: string, input: string | AnalyticsQuery, now: Date = new Date()) {
  const tz = await getRestaurantTimezone(restaurantId)
  const query = coerceAnalyticsQuery(input)
  if (query.range === 'custom' && query.from && query.to) {
    return customRangeWindow(tz, query.from, query.to, now)
  }
  return rangeWindow(tz, query.range, now)
}

export function analyticsOrderReadFilters(input: string | AnalyticsQuery): AnalyticsOrderReadFilters | undefined {
  const { filters } = coerceAnalyticsQuery(input)
  const result: AnalyticsOrderReadFilters = {}
  if (filters.source !== 'all') result.source = filters.source
  if (filters.paymentMethod !== 'all') result.paymentMethod = filters.paymentMethod
  if (filters.status !== 'all') result.status = filters.status
  return Object.keys(result).length > 0 ? result : undefined
}

export const getAnalyticsCoreMetrics = cache(async function getAnalyticsCoreMetrics(
  restaurantId: string,
  input: string | AnalyticsQuery,
  asOf: Date,
) {
  const query = coerceAnalyticsQuery(input)
  const timezone = await getRestaurantTimezone(restaurantId)
  const { currentStart, previousStart, currentEnd } = await rangeWindowFor(restaurantId, query, asOf)
  const context = await getInsightsContext(restaurantId, 'analytics')
  const result = await readAnalyticsCoreMetrics(context, {
    restaurantId,
    since: previousStart.toISOString(),
    currentStart: currentStart.toISOString(),
    before: currentEnd.toISOString(),
    timezone,
    filters: analyticsOrderReadFilters(query),
  }, insightsReadModel)
  if (!result.ok) throw new Error(`getAnalyticsCoreMetrics: ${result.error}`)
  return { ...result.value, currentStart, previousStart, currentEnd, timezone }
})

export type AnalyticsCoreMetrics = Awaited<ReturnType<typeof getAnalyticsCoreMetrics>>

export function foldOrderItems(
  rows: AnalyticsFinancialOrder[],
  since?: Date,
) {
  return foldOrderItemsToNet(rows, since)
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
