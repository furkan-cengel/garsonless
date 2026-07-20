import {
  startOfRestaurantDay,
  startOfDayNDaysAgo,
  restaurantDayKey,
  restaurantHour,
  restaurantWeekday,
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
  analyticsReadModel,
  COMP_METHOD,
  foldOrderItems,
  getInsightsContext,
  getRestaurantTimezone,
  insightsReadModel,
  isOrderVolumeRow,
  rangeWindowFor,
  sumTotals,
  type DashboardKPIs,
  type TopItem,
} from './insights-shared'

export type { DashboardKPIs, TopItem } from './insights-shared'

export interface PaymentBreakdown {
  key: string
  label: string
  amount: number
  count: number
  /** Share of the collected base. Comp is never part of this base. */
  pct: number
}

export interface PaymentReport {
  collected: PaymentBreakdown[]
  comp: { amount: number; count: number }
  collectedTotal: number
  collectedCount: number
}

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
  const today = startOfRestaurantDay(tz)
  const yesterday = startOfDayNDaysAgo(tz, 1)
  const context = await getInsightsContext(restaurantId, section)
  const [volumeResult, collectedResult] = await Promise.all([
    readDashboardOrderVolume(context, {
      restaurantId, section, since: yesterday.toISOString(),
    }, insightsReadModel),
    readDashboardCollectedOrders(context, {
      restaurantId, section, since: yesterday.toISOString(),
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

export async function getTopItems(restaurantId: string, range = 'day'): Promise<TopItem[]> {
  const { currentStart } = await rangeWindowFor(restaurantId, range)
  const context = await getInsightsContext(restaurantId, 'analytics')
  const result = await readDashboardCollectedOrders(context, {
    restaurantId, section: 'analytics', since: currentStart.toISOString(),
  }, insightsReadModel)
  if (!result.ok) throw new Error(`getTopItems: ${result.error}`)
  const counts = foldOrderItems(result.value)

  return Array.from(counts.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
}

// P3 collected-bucket labels. 'unknown' = legacy paid orders with a null method
// (collected money, channel unknown) — kept in the tahsilat base, NOT a comp.
const COLLECTED_METHOD_LABELS: Record<string, string> = {
  iyzico: 'İyzico',
  cash: 'Nakit',
  pos: 'Fiziksel POS',
  split: 'Hesap bölüşme',
  unknown: 'Bilinmiyor (eski)',
}

export async function getPaymentBreakdown(restaurantId: string, range = 'week'): Promise<PaymentReport> {
  const empty: PaymentReport = { collected: [], comp: { amount: 0, count: 0 }, collectedTotal: 0, collectedCount: 0 }

  // Owner OR a member with 'analytics' (reads order aggregates via the service
  // role — so this app-layer gate, not RLS, is the protection).
  const gate = await assertAccess(restaurantId, 'analytics')
  if ('error' in gate) return empty

  const { currentStart } = await rangeWindowFor(restaurantId, range)
  const result = await analyticsReadModel.readPaymentOrders({
    restaurantId,
    since: currentStart.toISOString(),
  })
  if (!result.ok) throw new Error(`getPaymentBreakdown: ${result.error}`)

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
  const collected = Object.values(collectedGroups)
    .filter((g) => g.count > 0)
    .map((g) => ({ ...g, pct: collectedTotal > 0 ? Math.round((g.amount / collectedTotal) * 1000) / 10 : 0 }))
    .sort((a, b) => b.amount - a.amount)

  return { collected, comp, collectedTotal, collectedCount }
}

export async function getProductReportData(restaurantId: string, range = 'week'): Promise<ProductReportItem[]> {
  const { currentStart, previousStart } = await rangeWindowFor(restaurantId, range)
  const context = await getInsightsContext(restaurantId, 'analytics')
  const result = await readDashboardCollectedOrders(context, {
    restaurantId, section: 'analytics', since: previousStart.toISOString(),
  }, insightsReadModel)
  if (!result.ok) throw new Error(`getProductReportData: ${result.error}`)
  const current = foldOrderItems(result.value.filter((row) => new Date(row.paidAt) >= currentStart))
  const previous = foldOrderItems(result.value.filter((row) => new Date(row.paidAt) < currentStart))
  const totalRevenue = Array.from(current.values()).reduce((sum, item) => sum + item.revenue, 0)

  let cumulative = 0
  return Array.from(current.entries())
    .map(([name, value]) => {
      const prevRevenue = previous.get(name)?.revenue ?? 0
      const deltaPct = prevRevenue > 0
        ? Math.round(((value.revenue - prevRevenue) / prevRevenue) * 1000) / 10
        : value.revenue > 0 ? null : 0
      return { name, ...value, deltaPct }
    })
    .sort((a, b) => b.revenue - a.revenue)
    .map((item) => {
      const sharePct = totalRevenue > 0 ? Math.round((item.revenue / totalRevenue) * 1000) / 10 : 0
      const cumulativeBefore = cumulative
      cumulative += sharePct
      const cumulativePct = Math.min(100, Math.round(cumulative * 10) / 10)
      const abcClass: ProductReportItem['abcClass'] = cumulativeBefore < 80 ? 'A' : cumulativeBefore < 95 ? 'B' : 'C'
      return { ...item, sharePct, cumulativePct, abcClass }
    })
}

export async function getSalesOverTime(
  restaurantId: string,
  range: string,
  section: DashboardInsightsSection = 'analytics',
): Promise<DailySale[]> {
  const tz = await getRestaurantTimezone(restaurantId)

  const isHourly = range === 'day'
  const bucketCount = isHourly ? 24 : ({ week: 7, month: 30, quarter: 90, year: 365 } as Record<string, number>)[range] ?? 7

  // Restaurant-local window boundaries (UTC instants).
  const currentStart = isHourly ? startOfRestaurantDay(tz) : startOfDayNDaysAgo(tz, bucketCount - 1)
  const prevStart = isHourly ? startOfDayNDaysAgo(tz, 1) : startOfDayNDaysAgo(tz, 2 * bucketCount - 1)

  const context = await getInsightsContext(restaurantId, section)
  const result = await readDashboardCollectedOrders(context, {
    restaurantId, section, since: prevStart.toISOString(),
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
    const daysAgo = bucketCount - 1 - i // i=0 → oldest day … last → today
    const dayStart = startOfDayNDaysAgo(tz, daysAgo)
    const prevDayStart = startOfDayNDaysAgo(tz, daysAgo + bucketCount)
    return {
      date: dayStart.toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', timeZone: tz }),
      current: currentMap[restaurantDayKey(dayStart, tz)] ?? 0,
      prev: prevMap[restaurantDayKey(prevDayStart, tz)] ?? 0,
    }
  })
}

export async function getHeatmapData(restaurantId: string): Promise<HeatmapCell[]> {
  const tz = await getRestaurantTimezone(restaurantId)
  const since = startOfDayNDaysAgo(tz, 30)
  const context = await getInsightsContext(restaurantId, 'analytics')
  const result = await readDashboardOrderVolume(context, {
    restaurantId, section: 'analytics', since: since.toISOString(),
  }, insightsReadModel)
  if (!result.ok) throw new Error(`getHeatmapData: ${result.error}`)
  const rows = result.value.filter(isOrderVolumeRow)
  const grid: Record<string, number> = {}

  for (const row of rows) {
    const day = restaurantWeekday(row.createdAt, tz)
    const hour = restaurantHour(row.createdAt, tz)
    const k = `${day}-${hour}`
    grid[k] = (grid[k] ?? 0) + 1
  }

  const cells: HeatmapCell[] = []
  for (let day = 0; day < 7; day++) {
    for (let hour = 8; hour <= 22; hour++) {
      cells.push({ day, hour, count: grid[`${day}-${hour}`] ?? 0 })
    }
  }
  return cells
}

export async function getTablesReportData(restaurantId: string, range = 'week'): Promise<TableReportRow[]> {
  const { currentStart } = await rangeWindowFor(restaurantId, range)
  const since = currentStart.toISOString()
  const context = await getInsightsContext(restaurantId, 'analytics')
  const result = await readDashboardTablePerformance(context, { restaurantId, since }, insightsReadModel)
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
    a.orders += 1
  }
  for (const s of closedSessions) {
    const mins = (new Date(s.closedAt).getTime() - new Date(s.openedAt).getTime()) / 60_000
    if (!Number.isFinite(mins) || mins < 0) continue
    const a = agg(s.tableId)
    a.turnover += 1
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
