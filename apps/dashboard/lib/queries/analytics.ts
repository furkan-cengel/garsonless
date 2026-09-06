import { sumAnalyticsSalesBuckets } from '../analytics-sales-buckets'
import { projectAnalyticsProducts } from '../analytics-product-projection'
import {
  startOfRestaurantDay,
  startOfDayNDaysAgo,
  restaurantCalendarDayCount,
  restaurantDayKey,
  restaurantHour,
} from '@garsonless/db/browser'
import {
  readDashboardCollectedOrders,
  readDashboardOrderVolume,
  readDashboardTablePerformance,
  type DashboardInsightsSection,
} from '@garsonless/application/read-models'
import { ACTIVE_ORDER_STATUSES } from '@garsonless/domain'
import { assertAccess } from '../auth/access'
import {
  aggregateCollectedFinancials,
} from '../analytics-financial-model'
import { aggregateRefundSummary, type PaymentReport } from '../analytics-payment-model'
import { projectPaymentAggregate } from '../analytics-payment-aggregate'
export type { PaymentBreakdown, PaymentReport } from '../analytics-payment-model'
import {
  analyticsReadModel,
  analyticsOrderReadFilters,
  COMP_METHOD,
  getAnalyticsCoreMetrics,
  getInsightsContext,
  getRestaurantTimezone,
  insightsReadModel,
  isOrderVolumeRow,
  rangeWindowFor,
  sumTotals,
  type DashboardKPIs,
  type AnalyticsCoreMetrics,
  type TopItem,
} from './insights-shared'
import { coerceAnalyticsQuery, type AnalyticsQuery } from '../analytics-filter-contract'
import { getAnalyticsRangeKPIs } from './analytics-range-kpis-query'

export type { AnalyticsRangeKPIs, DashboardKPIs, TopItem } from './insights-shared'

export interface ProductReportItem {
  name: string
  count: number
  revenue: number
  sharePct: number
  cumulativePct: number
  abcClass: 'A' | 'B' | 'C'
  deltaPct: number | null
}

export interface DailySale {
  date: string
  current: number
  prev: number
}

export interface HeatmapCell {
  day: number
  hour: number
  count: number
}

export interface TableReportRow {
  id: string
  label: string
  revenue: number
  orders: number
  /** Sessions closed in range; open sessions are excluded. */
  turnover: number
  avgDwellMinutes: number | null
  openNow: boolean
}

export async function getDashboardKPIs(
  restaurantId: string,
  section: DashboardInsightsSection = 'analytics',
): Promise<DashboardKPIs> {
  const tz = await getRestaurantTimezone(restaurantId)
  const currentEnd = new Date()
  const today = startOfRestaurantDay(tz, currentEnd)
  const yesterday = startOfDayNDaysAgo(tz, 1, currentEnd)
  const context = await getInsightsContext(restaurantId, section)
  const [volumeResult, collectedResult] = await Promise.all([
    readDashboardOrderVolume(context, {
      restaurantId, section, since: yesterday.toISOString(), before: currentEnd.toISOString(),
    }, insightsReadModel),
    readDashboardCollectedOrders(context, {
      restaurantId, section, since: yesterday.toISOString(), before: currentEnd.toISOString(),
    }, insightsReadModel),
  ])
  if (!volumeResult.ok) throw new Error(`getDashboardKPIs: ${volumeResult.error}`)
  if (!collectedResult.ok) throw new Error(`getDashboardKPIs: ${collectedResult.error}`)

  const todayVolumeRows = volumeResult.value
    .filter((row) => new Date(row.createdAt) >= today)
    .filter(isOrderVolumeRow)
  const yesterdayVolumeRows = volumeResult.value
    .filter((row) => new Date(row.createdAt) < today)
    .filter(isOrderVolumeRow)
  const todayCollectedRows = collectedResult.value.filter((row) => new Date(row.paidAt) >= today)
  const yesterdayCollectedRows = collectedResult.value.filter((row) => new Date(row.paidAt) < today)

  const revenue = sumTotals(todayCollectedRows)
  const revenueYesterday = sumTotals(yesterdayCollectedRows)
  const orders = todayVolumeRows.length
  const ordersYesterday = yesterdayVolumeRows.length
  const paidOrders = todayCollectedRows.length
  const paidOrdersYesterday = yesterdayCollectedRows.length
  const activeOrders = todayVolumeRows.filter((row) => ACTIVE_ORDER_STATUSES.some((status) => status === row.status)).length
  const avgBasket = paidOrders > 0 ? Math.round(revenue / paidOrders) : 0
  const sessions = new Set(todayVolumeRows.map(r => r.sessionId).filter(Boolean)).size
  const sessionsYesterday = new Set(yesterdayVolumeRows.map(r => r.sessionId).filter(Boolean)).size

  return { revenue, revenueYesterday, orders, ordersYesterday, paidOrders, paidOrdersYesterday, activeOrders, avgBasket, sessions, sessionsYesterday }
}

/** The analytics header needs one number, not the full Pano KPI snapshot. */
export async function getAnalyticsActiveOrderCount(restaurantId: string): Promise<number> {
  const gate = await assertAccess(restaurantId, 'analytics')
  if ('error' in gate) return 0
  const read = analyticsReadModel.readActiveOrderCount
  if (!read) return (await getDashboardKPIs(restaurantId)).activeOrders
  const result = await read({ restaurantId })
  if (!result.ok) throw new Error(`getAnalyticsActiveOrderCount: ${result.error}`)
  return result.value
}

async function getTopItems(
  restaurantId: string,
  range: string | AnalyticsQuery = 'day',
  asOf = new Date(),
  coreSource?: AnalyticsCoreMetrics,
): Promise<TopItem[]> {
  const source = coreSource ?? await getAnalyticsCoreMetrics(restaurantId, range, asOf)
  return source.products
    .filter((item) => item.period === 'current')
    .map(({ name, count, revenue }) => ({ name, count, revenue }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
}

const COLLECTED_METHOD_LABELS: Record<string, string> = {
  iyzico: 'İyzico',
  cash: 'Nakit',
  pos: 'Fiziksel POS',
  split: 'Hesap bölüşme',
  unknown: 'Bilinmiyor (eski)',
}

export async function getPaymentBreakdown(restaurantId: string, range: string | AnalyticsQuery = 'week', asOf = new Date()): Promise<PaymentReport> {
  const empty: PaymentReport = {
    collected: [],
    comp: { amount: 0, count: 0 },
    collectedTotal: 0,
    collectedCount: 0,
    financials: {
      grossSales: 0,
      discountTotal: 0,
      netSales: 0,
      vatTotal: 0,
      netOfVatTotal: 0,
      unknownVatGross: 0,
      unattributedAmount: 0,
    },
    refunds: { total: 0, count: 0, fullCount: 0, partialCount: 0, netCollected: 0, byMethod: [] },
    coverage: { monetaryRefunds: true, serviceFees: false, tips: false },
  }

  // Owner OR a member with 'analytics' (reads order aggregates via the service
  // role — so this app-layer gate, not RLS, is the protection).
  const gate = await assertAccess(restaurantId, 'analytics')
  if ('error' in gate) return empty

  const { currentStart, currentEnd } = await rangeWindowFor(restaurantId, range, asOf)
  const filters = analyticsOrderReadFilters(range)
  if (analyticsReadModel.readPaymentAggregate) {
    const aggregateResult = await analyticsReadModel.readPaymentAggregate({
      restaurantId, since: currentStart.toISOString(), before: currentEnd.toISOString(), filters,
    })
    if (!aggregateResult.ok) throw new Error(`getPaymentBreakdown: ${aggregateResult.error}`)
    return projectPaymentAggregate(aggregateResult.value)
  }
  const [result, refundResult] = await Promise.all([
    analyticsReadModel.readPaymentOrders({
      restaurantId, since: currentStart.toISOString(), before: currentEnd.toISOString(), filters,
    }),
    analyticsReadModel.readRefunds({
      restaurantId, since: currentStart.toISOString(), before: currentEnd.toISOString(), filters,
    }),
  ])
  if (!result.ok) throw new Error(`getPaymentBreakdown: ${result.error}`)
  const monetaryRefundsAvailable = refundResult.ok

  const collectedGroups: Record<string, { key: string; label: string; amount: number; count: number }> = {
    iyzico: { key: 'iyzico', label: COLLECTED_METHOD_LABELS['iyzico']!, amount: 0, count: 0 },
    cash: { key: 'cash', label: COLLECTED_METHOD_LABELS['cash']!, amount: 0, count: 0 },
    pos: { key: 'pos', label: COLLECTED_METHOD_LABELS['pos']!, amount: 0, count: 0 },
    split: { key: 'split', label: COLLECTED_METHOD_LABELS['split']!, amount: 0, count: 0 },
    unknown: { key: 'unknown', label: COLLECTED_METHOD_LABELS['unknown']!, amount: 0, count: 0 },
  }
  const comp = { amount: 0, count: 0 }

  for (const row of result.value) {
    const amount = row.total ?? 0
    const method = row.paymentMethod
    if (method === COMP_METHOD) {
      comp.amount += amount
      comp.count += 1
      continue
    }
    const key = method === 'iyzico' || method === 'cash' || method === 'pos' || method === 'split'
      ? method
      : 'unknown'
    collectedGroups[key]!.amount += amount
    collectedGroups[key]!.count += 1
  }

  const collectedTotal = Object.values(collectedGroups).reduce((sum, g) => sum + g.amount, 0)
  const collectedCount = Object.values(collectedGroups).reduce((sum, g) => sum + g.count, 0)
  const financials = aggregateCollectedFinancials(
    result.value.filter((row) => row.paymentMethod !== COMP_METHOD),
  )
  const collected = Object.values(collectedGroups)
    .filter((g) => g.count > 0)
    .map((g) => ({ ...g, pct: collectedTotal > 0 ? Math.round((g.amount / collectedTotal) * 1000) / 10 : 0 }))
    .sort((a, b) => b.amount - a.amount)

  const refunds = aggregateRefundSummary(refundResult.ok ? refundResult.value : [], collectedTotal)

  return {
    collected,
    comp,
    collectedTotal,
    collectedCount,
    financials,
    refunds,
    coverage: { monetaryRefunds: monetaryRefundsAvailable, serviceFees: false, tips: false },
  }
}

export async function getProductReportData(restaurantId: string, range: string | AnalyticsQuery = 'week', asOf = new Date()): Promise<ProductReportItem[]> {
  const source = await getAnalyticsCoreMetrics(restaurantId, range, asOf)
  return projectAnalyticsProducts(source.products)
}

export async function getSalesOverTime(
  restaurantId: string,
  range: string | AnalyticsQuery,
  section: DashboardInsightsSection = 'analytics',
  asOf = new Date(),
  coreSource?: AnalyticsCoreMetrics,
): Promise<DailySale[]> {
  const tz = await getRestaurantTimezone(restaurantId)
  const query = coerceAnalyticsQuery(range)
  const { currentStart, previousStart, currentEnd } = await rangeWindowFor(restaurantId, query, asOf)
  const lastCurrentInstant = new Date(Math.max(currentStart.getTime(), currentEnd.getTime() - 1))
  const bucketCount = restaurantCalendarDayCount(
    restaurantDayKey(currentStart, tz),
    restaurantDayKey(lastCurrentInstant, tz),
  )
  const isHourly = bucketCount === 1
  if (section === 'analytics') {
    const source = coreSource ?? await getAnalyticsCoreMetrics(restaurantId, query, asOf)
    if (isHourly) {
      const currentMap = sumAnalyticsSalesBuckets(source.sales, 'current', (row) => row.hour)
      const previousMap = sumAnalyticsSalesBuckets(source.sales, 'previous', (row) => row.hour)
      return Array.from({ length: 24 }, (_, hour) => ({
        date: `${hour.toString().padStart(2, '0')}:00`,
        current: currentMap.get(hour) ?? 0,
        prev: previousMap.get(hour) ?? 0,
      }))
    }
    const currentMap = sumAnalyticsSalesBuckets(source.sales, 'current', (row) => row.day)
    const previousMap = sumAnalyticsSalesBuckets(source.sales, 'previous', (row) => row.day)
    return Array.from({ length: bucketCount }, (_, i) => {
      const dayStart = startOfDayNDaysAgo(tz, -i, currentStart)
      const prevDayStart = startOfDayNDaysAgo(tz, -i, previousStart)
      return {
        date: dayStart.toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', timeZone: tz }),
        current: currentMap.get(restaurantDayKey(dayStart, tz)) ?? 0,
        prev: previousMap.get(restaurantDayKey(prevDayStart, tz)) ?? 0,
      }
    })
  }

  const context = await getInsightsContext(restaurantId, section)
  const result = await readDashboardCollectedOrders(context, {
    restaurantId, section, since: previousStart.toISOString(), before: currentEnd.toISOString(),
  }, insightsReadModel)
  if (!result.ok) throw new Error(`getSalesOverTime: ${result.error}`)
  const rows = result.value

  if (isHourly) {
    const currentMap: Record<number, number> = {}
    const prevMap: Record<number, number> = {}
    for (const row of rows) {
      const map = new Date(row.paidAt) >= currentStart ? currentMap : prevMap
      const h = restaurantHour(row.paidAt, tz)
      map[h] = (map[h] ?? 0) + row.total
    }
    return Array.from({ length: 24 }, (_, h) => ({
      date: `${h.toString().padStart(2, '0')}:00`,
      current: currentMap[h] ?? 0,
      prev: prevMap[h] ?? 0,
    }))
  }

  // Daily: row key AND output bucket key now share ONE basis (restaurant-local
  // day) → "today" is never orphaned and the result no longer depends on the
  // server timezone. This is the acute getSalesOverTime bug's fix.
  const currentMap: Record<string, number> = {}
  const prevMap: Record<string, number> = {}
  for (const row of rows) {
    const key = restaurantDayKey(row.paidAt, tz)
    const map = new Date(row.paidAt) >= currentStart ? currentMap : prevMap
    map[key] = (map[key] ?? 0) + row.total
  }

  return Array.from({ length: bucketCount }, (_, i) => {
    const dayStart = startOfDayNDaysAgo(tz, -i, currentStart)
    const prevDayStart = startOfDayNDaysAgo(tz, -i, previousStart)
    return {
      date: dayStart.toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', timeZone: tz }),
      current: currentMap[restaurantDayKey(dayStart, tz)] ?? 0,
      prev: prevMap[restaurantDayKey(prevDayStart, tz)] ?? 0,
    }
  })
}

async function getHeatmapData(
  restaurantId: string,
  range: string | AnalyticsQuery = 'month',
  asOf = new Date(),
  coreSource?: AnalyticsCoreMetrics,
): Promise<HeatmapCell[]> {
  const source = coreSource ?? await getAnalyticsCoreMetrics(restaurantId, range, asOf)
  return source.heatmap
}

/** One explicit aggregate read per sales request. Route handlers do not rely
 * on React render-cache behavior for query-count correctness. */
export async function getAnalyticsSalesReportData(
  restaurantId: string,
  range: string | AnalyticsQuery,
  asOf = new Date(),
) {
  const [core, paymentBreakdown, liveActiveOrders] = await Promise.all([
    getAnalyticsCoreMetrics(restaurantId, range, asOf),
    getPaymentBreakdown(restaurantId, range, asOf),
    getAnalyticsActiveOrderCount(restaurantId),
  ])
  const [rangeKpis, salesOverTime, heatmapData, topItems] = await Promise.all([
    getAnalyticsRangeKPIs(restaurantId, range, asOf, core),
    getSalesOverTime(restaurantId, range, 'analytics', asOf, core),
    getHeatmapData(restaurantId, range, asOf, core),
    getTopItems(restaurantId, range, asOf, core),
  ])
  return { rangeKpis, salesOverTime, heatmapData, topItems, paymentBreakdown, liveActiveOrders }
}

export async function getTablesReportData(restaurantId: string, range: string | AnalyticsQuery = 'week', asOf = new Date()): Promise<TableReportRow[]> {
  const { currentStart, currentEnd } = await rangeWindowFor(restaurantId, range, asOf)
  const filters = analyticsOrderReadFilters(range)
  const since = currentStart.toISOString()
  const context = await getInsightsContext(restaurantId, 'analytics')
  const result = await readDashboardTablePerformance(context, {
    restaurantId,
    since,
    before: currentEnd.toISOString(),
    filters,
  }, insightsReadModel)
  if (!result.ok) throw new Error(`getTablesReportData: ${result.error}`)
  const { tables, orders, closedSessions } = result.value
  const openTables = new Set(result.value.openTableIds)

  type Agg = { revenue: number; orders: number; turnover: number; dwellSum: number }
  const byTable = new Map<string, Agg>()
  const agg = (id: string): Agg => {
    if (!byTable.has(id)) byTable.set(id, { revenue: 0, orders: 0, turnover: 0, dwellSum: 0 })
    return byTable.get(id)!
  }

  for (const order of orders) {
    const a = agg(order.tableId)
    a.revenue += order.total
    a.orders += order.count ?? 1
  }
  for (const s of closedSessions) {
    const mins = s.dwellSumMinutes ?? (
      s.closedAt && s.openedAt
        ? (new Date(s.closedAt).getTime() - new Date(s.openedAt).getTime()) / 60_000
        : Number.NaN
    )
    const turnover = s.turnover ?? 1
    if (!Number.isFinite(mins) || mins < 0 || !Number.isFinite(turnover) || turnover < 0) continue
    const a = agg(s.tableId)
    a.turnover += turnover
    a.dwellSum += mins
  }

  return tables.map(t => {
    const a = byTable.get(t.id)
    return {
      id: t.id,
      label: t.label,
      revenue: a?.revenue ?? 0,
      orders: a?.orders ?? 0,
      turnover: a?.turnover ?? 0,
      avgDwellMinutes: a && a.turnover > 0 ? Math.round(a.dwellSum / a.turnover) : null,
      openNow: openTables.has(t.id),
    }
  })
}

export * from './analytics-operations'
export * from './analytics-range-kpis-query'
