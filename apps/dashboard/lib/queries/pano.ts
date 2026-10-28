import {
  startOfRestaurantDay,
  startOfDayNDaysAgo,
} from '@garsonless/db/browser'
import {
  readPanoBusiness,
  readPanoMetrics,
  readPanoOperationalSource,
  readPanoStaff,
  readPanoTill,
  type PanoBusinessSource,
  type PanoStaffSource,
  type PanoMetricsSource,
  type PanoOperationalSource,
} from '@garsonless/application/read-models'
import { readOpenCustomerFeedback } from '@garsonless/application/customers'
import { createCustomerApplicationPort } from '@garsonless/db/server'
import { getDashboardFeatureContext } from './context'
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
  | 'stale_table'
  | 'service_request'
  | 'payment_configuration'
  | 'customer_feedback'
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

/** An order someone on the floor must approve, or serve once it is ready. */
export type PanoActionableOrder = PanoOperationalSource['actionableOrders'][number] & { tableLabel: string | null }

export interface PanoSnapshot {
  generatedAt: string
  timezone: string
  errors: string[]
  kpis: DashboardKPIs
  orderSummary: PanoOrderSummary
  attentionItems: PanoAttentionItem[]
  /** Null unless the viewer may see revenue (owner or the analytics section). */
  business: PanoBusinessSource | null
  /** Today's till for the shift view: analytics or the cash section; null otherwise. */
  till: PanoBusinessSource['today'] | null
  /** Today's shift list; same audience as the till. */
  staff: PanoStaffSource | null
  hourlySales: HourlySale[]
  initialFeed: ActivityEvent[]
  topItems: TopItem[]
  tableStatuses: TableStatusData[]
  heatmap: HeatmapCell[]
  pendingServiceRequests: PanoServiceRequest[]
  actionableOrders: PanoActionableOrder[]
  paymentStatus: PaymentStatus | null
  health: PanoSnapshotHealth
}

export interface PanoSnapshotHealth {
  metrics: 'fresh' | 'failed'
  operational: 'fresh' | 'degraded'
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

/** Operational counts stay; money, trends and products are dropped for staff. */
function withoutBusinessFigures(metrics: PanoMetricsSource, canAnalytics: boolean): PanoMetricsSource {
  if (canAnalytics) return metrics
  return { ...metrics, revenue: 0, revenueYesterday: 0, hourlySales: [], topItems: [], heatmap: [] }
}

/** One period of the business view, for the 7 / 30 day switch. */
export async function getPanoBusiness(restaurantId: string, periodDays: 7 | 30): Promise<PanoBusinessSource> {
  const [timezone, context] = await Promise.all([getRestaurantTimezone(restaurantId), getInsightsContext(restaurantId, 'analytics')])
  const result = await readPanoBusiness(context, { restaurantId, now: new Date().toISOString(), timezone, periodDays }, insightsReadModel)
  if (!result.ok) throw new Error(`getPanoBusiness: ${result.error}`)
  return result.value
}

export async function getPanoSnapshot(restaurantId: string): Promise<PanoSnapshot> {
  const generatedAtDate = new Date()
  const generatedAt = generatedAtDate.toISOString()
  const timezone = await getRestaurantTimezone(restaurantId)
  const today = startOfRestaurantDay(timezone, generatedAtDate)
  const yesterday = startOfDayNDaysAgo(timezone, 1, generatedAtDate)
  const heatmapStart = startOfDayNDaysAgo(timezone, 30, generatedAtDate)
  const context = await getInsightsContext(restaurantId, 'pano')

  // Low ratings are customer data: only people with customer access get them.
  const feedbackPromise = getDashboardFeatureContext(restaurantId)
    .then((actor) => (actor ? readOpenCustomerFeedback(actor, { restaurantId, limit: 3 }, createCustomerApplicationPort()) : null))
    .catch(() => null)
  // Revenue, trends and product figures are business data. Members without the
  // analytics section never receive them, not just never see them.
  const canAnalytics = context.isOwner === true || context.permissions.includes('analytics')
  const canCash = canAnalytics || context.permissions.includes('cash')
  const [metricsResult, operationalResult, feedbackResult, businessResult, tillResult, staffResult] = await Promise.all([
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
    feedbackPromise,
    canAnalytics
      ? readPanoBusiness(context, { restaurantId, now: generatedAt, timezone, periodDays: 7 }, insightsReadModel)
      : null,
    canCash && !canAnalytics
      ? readPanoTill(context, { restaurantId, now: generatedAt, timezone }, insightsReadModel)
      : null,
    canCash ? readPanoStaff(context, { restaurantId, now: generatedAt, timezone }, insightsReadModel) : null,
  ])

  if (!operationalResult.ok) throw new Error(`getPanoSnapshot: ${operationalResult.error}`)
  const operational = operationalResult.value
  const errors = [...operational.errors]
  if (!metricsResult.ok) errors.push(`Pano metrikleri: ${metricsResult.error}`)
  const metrics = withoutBusinessFigures(metricsResult.ok ? metricsResult.value : emptyPanoMetrics(), canAnalytics)
  if (businessResult && !businessResult.ok) errors.push(`Pano işletme özeti: ${businessResult.error}`)

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
  const tableStatuses = projectPanoTableStatuses(operational, generatedAtDate.getTime(), today.getTime())
  const attentionItems = buildPanoAttentionItems({
    restaurantId,
    generatedAt,
    pendingOrderCount: metrics.pendingOrders,
    recentOrders: metrics.recentOrders,
    tableStatuses,
    serviceRequests: operational.pendingServiceRequests,
    paymentStatus,
    feedback: feedbackResult?.ok ? feedbackResult.value.items : [],
  })

  return {
    generatedAt,
    timezone,
    errors,
    kpis,
    orderSummary: { pending: metrics.pendingOrders, preparing: metrics.preparingOrders },
    attentionItems,
    business: businessResult?.ok ? businessResult.value : null,
    till: businessResult?.ok ? businessResult.value.today : tillResult?.ok ? tillResult.value : null,
    staff: staffResult?.ok ? staffResult.value : null,
    hourlySales: metrics.hourlySales,
    initialFeed: metrics.recentOrders,
    topItems: metrics.topItems,
    tableStatuses,
    heatmap: metrics.heatmap,
    pendingServiceRequests: operational.pendingServiceRequests,
    actionableOrders: operational.actionableOrders.map((order) => ({
      ...order,
      tableLabel: operational.tables.find((table) => table.id === order.tableId)?.label ?? null,
    })),
    paymentStatus,
    health: {
      metrics: metricsResult.ok ? 'fresh' : 'failed',
      operational: operational.errors.length === 0 ? 'fresh' : 'degraded',
    },
  }
}
