import {
  startOfRestaurantDay,
  startOfDayNDaysAgo,
  restaurantHour,
  restaurantWeekday,
} from '@garsonless/db/browser'
import {
  readDashboardCollectedOrders,
  readDashboardOrderVolume,
  readDashboardTableRefs,
  readPanoOperationalSource,
} from '@garsonless/application/read-models'
import {
  emptyKpis,
  foldOrderItems,
  getInsightsContext,
  getRestaurantTimezone,
  insightsReadModel,
  isOrderVolumeRow,
  sumTotals,
  type DashboardKPIs,
  type TableStatusData,
  type TopItem,
} from './insights-shared'
import type { HeatmapCell } from './analytics'

export type { DashboardKPIs, TableStatusData, TopItem } from './insights-shared'
export type { HeatmapCell } from './analytics'

export interface HourlySale {
  hour: number
  total: number
}

export interface ActivityEvent {
  id: string
  status: string
  total: number
  tableId: string | null
  tableLabel: string | null
  createdAt: string
}

export interface PanoSnapshot {
  timezone: string
  errors: string[]
  kpis: DashboardKPIs
  hourlySales: HourlySale[]
  initialFeed: ActivityEvent[]
  topItems: TopItem[]
  tableStatuses: TableStatusData[]
  heatmap: HeatmapCell[]
  paymentStatus: PaymentStatus | null
}

export async function getHourlySales(restaurantId: string): Promise<HourlySale[]> {
  const tz = await getRestaurantTimezone(restaurantId)
  const today = startOfRestaurantDay(tz)
  const context = await getInsightsContext(restaurantId, 'pano')
  const result = await readDashboardCollectedOrders(context, {
    restaurantId, section: 'pano', since: today.toISOString(),
  }, insightsReadModel)
  if (!result.ok) throw new Error(`getHourlySales: ${result.error}`)

  const byHour: Record<number, number> = {}
  for (let h = 0; h < 24; h++) byHour[h] = 0
  for (const row of result.value) {
    const h = restaurantHour(row.paidAt, tz)
    byHour[h] = (byHour[h] ?? 0) + row.total
  }
  return Array.from({ length: 24 }, (_, h) => ({ hour: h, total: byHour[h] ?? 0 }))
}

export async function getActivityFeed(restaurantId: string): Promise<ActivityEvent[]> {
  // Scope to TODAY + non-cancelled — the EXACT restaurant-local day boundary
  // getDashboardKPIs uses, so the feed and the KPI cards never disagree.
  const today = startOfRestaurantDay(await getRestaurantTimezone(restaurantId))

  const context = await getInsightsContext(restaurantId, 'pano')
  const [ordersResult, tablesResult] = await Promise.all([
    readDashboardOrderVolume(context, {
      restaurantId,
      section: 'pano',
      since: today.toISOString(),
      excludeCancelled: true,
      limit: 7,
    }, insightsReadModel),
    readDashboardTableRefs(context, {
      restaurantId, section: 'pano', includeDeleted: true,
    }, insightsReadModel),
  ])
  if (!ordersResult.ok) throw new Error(`getActivityFeed: ${ordersResult.error}`)
  if (!tablesResult.ok) throw new Error(`getActivityFeed: ${tablesResult.error}`)
  const orders = ordersResult.value.filter(isOrderVolumeRow)
  const labelById = new Map(tablesResult.value.map((table) => [table.id, table.label]))

  return orders.map(r => ({
    id: r.id,
    status: r.status,
    total: r.total,
    tableId: r.tableId,
    tableLabel: r.tableId ? labelById.get(r.tableId) ?? null : null,
    createdAt: r.createdAt,
  }))
}

export async function getTableStatuses(restaurantId: string): Promise<TableStatusData[]> {
  const context = await getInsightsContext(restaurantId, 'pano')
  const result = await readPanoOperationalSource(context, {
    restaurantId,
    includePaymentStatus: false,
  }, insightsReadModel)
  if (!result.ok) throw new Error(`getTableStatuses: ${result.error}`)
  const tables = result.value.tables.filter((table) => table.deletedAt === null)
  const sessions = result.value.openSessions.map((session) => ({
    id: session.id,
    table_id: session.tableId,
    opened_at: session.openedAt,
  }))
  const orders: Array<{
    table_session_id: string | null
    status: string
    total: number
    paid_at: string | null
    created_at: string
  }> = result.value.openSessionOrders.map((order) => ({
    table_session_id: order.tableSessionId,
    status: order.status,
    total: order.total,
    paid_at: order.paidAt,
    created_at: order.createdAt,
  }))

  const ordersBySession = new Map<string, typeof orders>()
  for (const order of orders) {
    if (!order.table_session_id) continue
    const list = ordersBySession.get(order.table_session_id) ?? []
    list.push(order)
    ordersBySession.set(order.table_session_id, list)
  }

  const sessionByTable = new Map(sessions.map((session) => [session.table_id, session]))

  return tables.map(t => {
    const session = sessionByTable.get(t.id)
    if (!session) {
      return {
        id: t.id,
        label: t.label,
        status: 'empty' as const,
        time: 0,
        total: 0,
        sessionId: null,
        openedAt: null,
        unpaidTotal: 0,
        splitSettledTotal: 0,
        splitDeclaredCashTotal: 0,
        orderCount: 0,
        hasUnfinished: false,
      }
    }

    const sessionOrders = ordersBySession.get(session.id) ?? []
    const activeOrders = sessionOrders.filter((order) => order.status !== 'cancelled')
    if (activeOrders.length === 0) {
      return {
        id: t.id,
        label: t.label,
        status: 'empty' as const,
        time: 0,
        total: 0,
        sessionId: session.id,
        openedAt: session.opened_at,
        unpaidTotal: 0,
        splitSettledTotal: 0,
        splitDeclaredCashTotal: 0,
        orderCount: 0,
        hasUnfinished: false,
      }
    }

    const total = activeOrders.reduce((sum, order) => sum + (order.total ?? 0), 0)
    const unpaidTotal = activeOrders
      .filter((order) => order.paid_at === null)
      .reduce((sum, order) => sum + (order.total ?? 0), 0)
    const unfinished = activeOrders.filter((order) => order.status !== 'served')
    const hasUnfinished = unfinished.length > 0
    const lastOrderAt = activeOrders
      .map((order) => new Date(order.created_at).getTime())
      .reduce((max, ts) => Math.max(max, ts), 0)
    const oldestUnfinishedAt = unfinished
      .map((order) => new Date(order.created_at).getTime())
      .reduce((min, ts) => Math.min(min, ts), Number.POSITIVE_INFINITY)
    const lastMins = lastOrderAt > 0 ? Math.max(0, Math.round((Date.now() - lastOrderAt) / 60000)) : 0
    const oldestUnfinishedMins = Number.isFinite(oldestUnfinishedAt)
      ? Math.max(0, Math.round((Date.now() - oldestUnfinishedAt) / 60000))
      : 0

    let status: TableStatusData['status'] = 'active'
    let time = lastMins
    if (hasUnfinished && oldestUnfinishedMins > 20) {
      status = 'late'
      time = oldestUnfinishedMins
    } else if (hasUnfinished && lastMins < 5) {
      status = 'new'
    } else if (!hasUnfinished && unpaidTotal <= 0) {
      status = 'paid'
      time = 0
    }

    return {
      id: t.id,
      label: t.label,
      status,
      time,
      total: unpaidTotal > 0 ? unpaidTotal : total,
      sessionId: session.id,
      openedAt: session.opened_at,
      unpaidTotal,
      splitSettledTotal: 0,
      splitDeclaredCashTotal: 0,
      orderCount: activeOrders.length,
      hasUnfinished,
    }
  })
}

export interface PaymentStatus {
  configured: boolean
  /** 'live' | 'sandbox' | null (null when not configured). */
  mode: string | null
}

export async function getPanoSnapshot(restaurantId: string): Promise<PanoSnapshot> {
  const tz = await getRestaurantTimezone(restaurantId)
  const today = startOfRestaurantDay(tz)
  const yesterday = startOfDayNDaysAgo(tz, 1)
  const heatmapStart = startOfDayNDaysAgo(tz, 30)
  const context = await getInsightsContext(restaurantId, 'pano')
  const [volumeResult, collectedResult, operationalResult] = await Promise.all([
    readDashboardOrderVolume(context, {
      restaurantId, section: 'pano', since: heatmapStart.toISOString(),
    }, insightsReadModel),
    readDashboardCollectedOrders(context, {
      restaurantId, section: 'pano', since: yesterday.toISOString(),
    }, insightsReadModel),
    readPanoOperationalSource(context, {
      restaurantId, sessionSince: yesterday.toISOString(), includePaymentStatus: true,
    }, insightsReadModel),
  ])
  if (!operationalResult.ok) throw new Error(`getPanoSnapshot: ${operationalResult.error}`)
  const operational = operationalResult.value

  const errors = [...operational.errors]
  if (!volumeResult.ok) errors.push(`Siparişler: ${volumeResult.error}`)
  if (!collectedResult.ok) errors.push(`Tahsilat: ${collectedResult.error}`)
  const orders = volumeResult.ok ? volumeResult.value : []
  const collectedOrders = collectedResult.ok ? collectedResult.value : []
  const todayRows = orders.filter((row) => new Date(row.createdAt) >= today)
  const yesterdayRows = orders.filter((row) => {
    const created = new Date(row.createdAt)
    return created >= yesterday && created < today
  })
  const todayVolumeRows = todayRows.filter(isOrderVolumeRow)
  const yesterdayVolumeRows = yesterdayRows.filter(isOrderVolumeRow)
  const todayCollectedRows = collectedOrders.filter((row) => new Date(row.paidAt) >= today)
  const yesterdayCollectedRows = collectedOrders.filter((row) => new Date(row.paidAt) < today)

  const revenue = sumTotals(todayCollectedRows)
  const paidOrders = todayCollectedRows.length
  const metricSessions = operational.sessionOpenings
  const sessionsToday = metricSessions.filter((session) => new Date(session.openedAt) >= today).length
  const sessionsYesterday = metricSessions.filter((session) => {
    const openedAt = new Date(session.openedAt)
    return openedAt >= yesterday && openedAt < today
  }).length
  const kpis: DashboardKPIs = {
    ...emptyKpis(),
    revenue,
    revenueYesterday: sumTotals(yesterdayCollectedRows),
    orders: todayVolumeRows.length,
    ordersYesterday: yesterdayVolumeRows.length,
    paidOrders,
    paidOrdersYesterday: yesterdayCollectedRows.length,
    activeOrders: operational.activeOrderCount,
    avgBasket: paidOrders > 0 ? Math.round(revenue / paidOrders) : 0,
    sessions: sessionsToday,
    sessionsYesterday,
  }

  const byHour: Record<number, number> = {}
  for (let h = 0; h < 24; h++) byHour[h] = 0
  for (const row of todayCollectedRows) {
    const h = restaurantHour(row.paidAt, tz)
    byHour[h] = (byHour[h] ?? 0) + row.total
  }
  const hourlySales: HourlySale[] = Array.from({ length: 24 }, (_, hour) => ({ hour, total: byHour[hour] ?? 0 }))

  const allTables = operational.tables
  const labelByTable = new Map(allTables.map((table) => [table.id, table.label]))
  const initialFeed: ActivityEvent[] = todayVolumeRows
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 7)
    .map((row) => ({
      id: row.id,
      status: row.status,
      total: row.total,
      tableId: row.tableId,
      tableLabel: row.tableId ? labelByTable.get(row.tableId) ?? null : null,
      createdAt: row.createdAt,
    }))

  const topItems = Array.from(foldOrderItems(todayCollectedRows).entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  const heatGrid: Record<string, number> = {}
  for (const row of orders.filter(isOrderVolumeRow)) {
    const day = restaurantWeekday(row.createdAt, tz)
    const hour = restaurantHour(row.createdAt, tz)
    const k = `${day}-${hour}`
    heatGrid[k] = (heatGrid[k] ?? 0) + 1
  }
  const heatmap: HeatmapCell[] = []
  for (let day = 0; day < 7; day++) {
    for (let hour = 8; hour <= 22; hour++) {
      heatmap.push({ day, hour, count: heatGrid[`${day}-${hour}`] ?? 0 })
    }
  }

  const sessions = operational.openSessions
  const sessionOrders = operational.openSessionOrders

  const ordersBySession = new Map<string, typeof sessionOrders>()
  for (const order of sessionOrders) {
    if (!order.tableSessionId) continue
    const list = ordersBySession.get(order.tableSessionId) ?? []
    list.push(order)
    ordersBySession.set(order.tableSessionId, list)
  }

  const sessionByTable = new Map(sessions.map((session) => [session.tableId, session]))
  const tableStatuses: TableStatusData[] = allTables
    .filter((table) => table.deletedAt === null)
    .map((table) => {
      const session = sessionByTable.get(table.id)
      if (!session) {
        return {
          id: table.id,
          label: table.label,
          status: 'empty' as const,
          time: 0,
          total: 0,
          sessionId: null,
          openedAt: null,
          unpaidTotal: 0,
          splitSettledTotal: 0,
          splitDeclaredCashTotal: 0,
          orderCount: 0,
          hasUnfinished: false,
        }
      }

      const activeOrders = (ordersBySession.get(session.id) ?? []).filter((order) => order.status !== 'cancelled')
      if (activeOrders.length === 0) {
        return {
          id: table.id,
          label: table.label,
          status: 'empty' as const,
          time: 0,
          total: 0,
          sessionId: session.id,
          openedAt: session.openedAt,
          unpaidTotal: 0,
          splitSettledTotal: 0,
          splitDeclaredCashTotal: 0,
          orderCount: 0,
          hasUnfinished: false,
        }
      }

      const total = activeOrders.reduce((sum, order) => sum + order.total, 0)
      const unpaidTotal = activeOrders
        .filter((order) => order.paidAt === null)
        .reduce((sum, order) => sum + order.total, 0)
      const unfinished = activeOrders.filter((order) => order.status !== 'served')
      const hasUnfinished = unfinished.length > 0
      const lastOrderAt = activeOrders
        .map((order) => new Date(order.createdAt).getTime())
        .reduce((max, ts) => Math.max(max, ts), 0)
      const oldestUnfinishedAt = unfinished
        .map((order) => new Date(order.createdAt).getTime())
        .reduce((min, ts) => Math.min(min, ts), Number.POSITIVE_INFINITY)
      const lastMins = lastOrderAt > 0 ? Math.max(0, Math.round((Date.now() - lastOrderAt) / 60000)) : 0
      const oldestUnfinishedMins = Number.isFinite(oldestUnfinishedAt)
        ? Math.max(0, Math.round((Date.now() - oldestUnfinishedAt) / 60000))
        : 0

      let status: TableStatusData['status'] = 'active'
      let time = lastMins
      if (hasUnfinished && oldestUnfinishedMins > 20) {
        status = 'late'
        time = oldestUnfinishedMins
      } else if (hasUnfinished && lastMins < 5) {
        status = 'new'
      } else if (!hasUnfinished && unpaidTotal <= 0) {
        status = 'paid'
        time = 0
      }

      return {
        id: table.id,
        label: table.label,
        status,
        time,
        total: unpaidTotal > 0 ? unpaidTotal : total,
        sessionId: session.id,
        openedAt: session.openedAt,
        unpaidTotal,
        splitSettledTotal: 0,
        splitDeclaredCashTotal: 0,
        orderCount: activeOrders.length,
        hasUnfinished,
      }
    })

  const paymentStatus = context.isOwner === true
    ? operational.paymentConfigured
      ? { configured: true, mode: operational.paymentMode }
      : { configured: false, mode: null }
    : null

  return { timezone: tz, errors, kpis, hourlySales, initialFeed, topItems, tableStatuses, heatmap, paymentStatus }
}
