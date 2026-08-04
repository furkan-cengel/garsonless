import {
  startOfRestaurantDay,
  startOfDayNDaysAgo,
  restaurantHour,
} from '@garsonless/db/browser'
import {
  readDashboardCollectedOrders,
  readPanoMetrics,
  readPanoOperationalSource,
  type PanoMetricsSource,
  type PanoOperationalSource,
} from '@garsonless/application/read-models'
import {
  emptyKpis,
  getInsightsContext,
  getRestaurantTimezone,
  insightsReadModel,
  type DashboardKPIs,
  type PanoOrderSummary,
  type TableStatusData,
  type TopItem,
} from './insights-shared'
import type { HeatmapCell } from './analytics'
import { projectPanoTableStatuses } from '../pano-table-status-model'
import { buildPanoAttentionItems } from '../pano-attention-model'

export type { DashboardKPIs, PanoOrderSummary, TableStatusData, TopItem } from './insights-shared'
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

export type PanoServiceRequest = PanoOperationalSource['pendingServiceRequests'][number]

type PanoAttentionKind =
  | 'pending_order'
  | 'late_table'
  | 'service_request'
  | 'payment_configuration'
  | 'connection'

export interface PanoAttentionItem {
  id: string
  kind: PanoAttentionKind
  severity: 'critical' | 'warning' | 'info'
  title: string
  detail: string
  createdAt: string
  tableId?: string
  orderId?: string
  actionHref?: string
}

export interface PanoSnapshot {
  generatedAt: string
  timezone: string
  errors: string[]
  kpis: DashboardKPIs
  orderSummary: PanoOrderSummary
  attentionItems: PanoAttentionItem[]
  hourlySales: HourlySale[]
  initialFeed: ActivityEvent[]
  topItems: TopItem[]
  tableStatuses: TableStatusData[]
  heatmap: HeatmapCell[]
  pendingServiceRequests: PanoServiceRequest[]
  paymentStatus: PaymentStatus | null
}

export interface PaymentStatus {
  configured: boolean
  /** 'live' | 'sandbox' | null (null when not configured). */
  mode: string | null
}

function emptyPanoMetrics(): PanoMetricsSource {
  return {
    revenue: 0,
    revenueYesterday: 0,
    orders: 0,
    ordersYesterday: 0,
    paidOrders: 0,
    paidOrdersYesterday: 0,
    activeOrders: 0,
    pendingOrders: 0,
    preparingOrders: 0,
    sessions: 0,
    sessionsYesterday: 0,
    hourlySales: Array.from({ length: 24 }, (_, hour) => ({ hour, total: 0 })),
    recentOrders: [],
    topItems: [],
    heatmap: Array.from({ length: 7 }, (_, day) => (
      Array.from({ length: 15 }, (_, index) => ({ day, hour: index + 8, count: 0 }))
    )).flat(),
  }
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
  return Array.from({ length: 24 }, (_, hour) => ({ hour, total: byHour[hour] ?? 0 }))
}

export async function getPanoSnapshot(restaurantId: string): Promise<PanoSnapshot> {
  const generatedAtDate = new Date()
  const generatedAt = generatedAtDate.toISOString()
  const timezone = await getRestaurantTimezone(restaurantId)
  const today = startOfRestaurantDay(timezone, generatedAtDate)
  const yesterday = startOfDayNDaysAgo(timezone, 1, generatedAtDate)
  const heatmapStart = startOfDayNDaysAgo(timezone, 30, generatedAtDate)
  const context = await getInsightsContext(restaurantId, 'pano')

  const [metricsResult, operationalResult] = await Promise.all([
    readPanoMetrics(context, {
      restaurantId,
      todayStart: today.toISOString(),
      yesterdayStart: yesterday.toISOString(),
      heatmapStart: heatmapStart.toISOString(),
      timezone,
    }, insightsReadModel),
    readPanoOperationalSource(context, {
      restaurantId,
      includePaymentStatus: true,
    }, insightsReadModel),
  ])

  if (!operationalResult.ok) throw new Error(`getPanoSnapshot: ${operationalResult.error}`)
  const operational = operationalResult.value
  const errors = [...operational.errors]
  if (!metricsResult.ok) errors.push(`Pano metrikleri: ${metricsResult.error}`)
  const metrics = metricsResult.ok ? metricsResult.value : emptyPanoMetrics()

  const kpis: DashboardKPIs = {
    ...emptyKpis(),
    revenue: metrics.revenue,
    revenueYesterday: metrics.revenueYesterday,
    orders: metrics.orders,
    ordersYesterday: metrics.ordersYesterday,
    paidOrders: metrics.paidOrders,
    paidOrdersYesterday: metrics.paidOrdersYesterday,
    activeOrders: metrics.activeOrders,
    avgBasket: metrics.paidOrders > 0 ? Math.round(metrics.revenue / metrics.paidOrders) : 0,
    sessions: metrics.sessions,
    sessionsYesterday: metrics.sessionsYesterday,
  }

  const paymentStatus = context.isOwner === true
    ? operational.paymentConfigured
      ? { configured: true, mode: operational.paymentMode }
      : { configured: false, mode: null }
    : null
  const tableStatuses = projectPanoTableStatuses(operational, generatedAtDate.getTime())
  const attentionItems = buildPanoAttentionItems({
    restaurantId,
    generatedAt,
    pendingOrderCount: metrics.pendingOrders,
    recentOrders: metrics.recentOrders,
    tableStatuses,
    serviceRequests: operational.pendingServiceRequests,
    paymentStatus,
  })

  return {
    generatedAt,
    timezone,
    errors,
    kpis,
    orderSummary: { pending: metrics.pendingOrders, preparing: metrics.preparingOrders },
    attentionItems,
    hourlySales: metrics.hourlySales,
    initialFeed: metrics.recentOrders,
    topItems: metrics.topItems,
    tableStatuses,
    heatmap: metrics.heatmap,
    pendingServiceRequests: operational.pendingServiceRequests,
    paymentStatus,
  }
}
