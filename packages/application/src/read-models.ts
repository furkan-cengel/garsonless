import type { DashboardActorContext, Result, ServiceRequestType } from '@garsonless/domain'
import { err, hasSameRestaurant } from '@garsonless/domain'
import type { OpenTableSession } from './tables'

export interface OrdersBoardTableRef {
  id: string
  label: string
}

export interface OrdersBoardReadModel<TOrder> {
  orders: TOrder[]
  tables: OrdersBoardTableRef[]
  hasKitchenAccess: boolean
}

export interface OrdersBoardReadModelPort<TOrder> {
  readBoard(input: {
    restaurantId: string
    since: string
    pageSize?: number
  }): Promise<Result<OrdersBoardReadModel<TOrder>>>
}

export interface PanoTableDetailOrderRow {
  id: string
  status: string
  total: number
  paidAt: string | null
  paymentMethod: string | null
  createdAt: string
  items: unknown
}

export interface PanoTableDetailReadModel {
  sessionId: string
  openedAt: string
  orders: PanoTableDetailOrderRow[]
}

export interface PanoTableDetailReadModelPort {
  readTableDetail(input: {
    restaurantId: string
    tableId: string
  }): Promise<Result<PanoTableDetailReadModel>>
}

export interface AnalyticsPaymentOrderRow {
  total: number | null
  paymentMethod: string | null
  items: unknown
}

export interface AnalyticsRefundRow {
  orderId?: string
  amount: number
  paymentMethod: 'cash' | 'pos' | 'iyzico'
  kind: 'full' | 'partial'
  refundedAt: string
}

export interface AnalyticsCancellationAggregate {
  current: {
    allOrders: number
    cancelledCount: number
    lostAmount: number
    collectedCancelledCount: number
    collectedCancelledAmount: number
    compCancelledCount: number
    compCancelledAmount: number
  }
  previous: { allOrders: number; cancelledCount: number; lostAmount: number }
  topItems: Array<{ name: string; count: number; revenue: number }>
  trend: Array<{ day: string; hour: number; count: number }>
}

export interface AnalyticsAbnormalSessionRow {
  id: string
  tableId: string
  closedAt: string
  closeReason: string
}

export interface AnalyticsUnpaidOrderRow {
  tableSessionId: string | null
  total: number | null
}

export interface AnalyticsStaffOrderRow {
  total: number | null
  paymentMethod: string | null
  settledBy: string | null
}

export interface AnalyticsStaffAggregateRow {
  settledBy: string | null
  cash: number
  pos: number
  otherCollected: number
  compAmount: number
  compCount: number
  settledCount: number
}

export interface AnalyticsStaffMemberRow {
  userId: string | null
  email: string
  permissions: string[]
}

export interface AnalyticsPaymentAggregate {
  groups: Array<{ paymentMethod: string | null; amount: number; count: number }>
  financials: {
    grossSales: number
    discountTotal: number
    netSales: number
    vatTotal: number
    netOfVatTotal: number
    unknownVatGross: number
    unattributedAmount: number
  }
  refunds: {
    total: number
    count: number
    fullCount: number
    partialCount: number
    groups: Array<{ paymentMethod: 'cash' | 'pos' | 'iyzico'; amount: number; count: number }>
  }
}

export interface AnalyticsLoyaltyRow {
  type: string
  direction: string
  delta: number
  reason: string
}

/** Server-trusted, allow-listed order dimensions. Multiple populated fields
 * are always combined with AND semantics by the DB adapters. */
export interface AnalyticsOrderReadFilters {
  source?: 'customer' | 'staff'
  paymentMethod?: 'cash' | 'pos' | 'iyzico' | 'split' | 'comp' | 'unknown'
  status?: 'pending_approval' | 'pending' | 'preparing' | 'ready' | 'served'
}

export interface AnalyticsReadModelPort {
  readActiveOrderCount?(input: { restaurantId: string }): Promise<Result<number>>
  readPaymentAggregate?(input: { restaurantId: string; since: string; before?: string; filters?: AnalyticsOrderReadFilters }): Promise<Result<AnalyticsPaymentAggregate>>
  readPaymentOrders(input: { restaurantId: string; since: string; before?: string; filters?: AnalyticsOrderReadFilters }): Promise<Result<AnalyticsPaymentOrderRow[]>>
  readRefunds(input: { restaurantId: string; since: string; before?: string; filters?: AnalyticsOrderReadFilters }): Promise<Result<AnalyticsRefundRow[]>>
  readCancellationAggregate(input: {
    restaurantId: string
    since: string
    currentStart: string
    before?: string
    timezone: string
    filters?: AnalyticsOrderReadFilters
  }): Promise<Result<AnalyticsCancellationAggregate>>
  readAbnormalCloseData(input: { restaurantId: string; since: string; before?: string }): Promise<Result<{
    sessions: AnalyticsAbnormalSessionRow[]
    unpaidOrders: AnalyticsUnpaidOrderRow[]
    tableLabels: Record<string, string>
  }>>
  readStaffSettlementData(input: { restaurantId: string; since: string; before?: string; filters?: AnalyticsOrderReadFilters }): Promise<Result<{
    orders: AnalyticsStaffOrderRow[]
    groups?: AnalyticsStaffAggregateRow[]
    ownerId: string | null
    ownerEmail: string | null
    members: AnalyticsStaffMemberRow[]
  }>>
  readLoyaltyRows(input: { restaurantId: string; since: string; before?: string }): Promise<Result<AnalyticsLoyaltyRow[]>>
}

export type DashboardInsightsSection = 'pano' | 'analytics'

export const DASHBOARD_INSIGHTS_OPERATIONS = [
  'analytics-core',
  'order-volume',
  'collected-orders',
  'table-refs',
  'table-performance',
  'pano-metrics',
  'pano-operational',
  'pano-business',
] as const

export type DashboardInsightsOperation = typeof DASHBOARD_INSIGHTS_OPERATIONS[number]

export type DashboardInsightsQueryOutcome = 'success' | 'degraded' | 'failure'

export interface DashboardInsightsQueryObservation {
  operation: DashboardInsightsOperation
  restaurantId: string
  durationMs: number
  outcome: DashboardInsightsQueryOutcome
  issueCount: number
  error?: string
}

/** Infrastructure output port; observers must never affect query results. */
export interface DashboardInsightsQueryObserver {
  observe(observation: DashboardInsightsQueryObservation): void | Promise<void>
}

export interface DashboardOrderVolumeRow {
  id: string
  total: number
  status: string
  sessionId: string | null
  tableId: string | null
  createdAt: string
}

export interface DashboardCollectedOrderRow {
  total: number
  paidAt: string
  paymentMethod: string | null
  createdAt: string
  tableId: string | null
  items: unknown
}

/** Bounded PostgreSQL projection for the high-cardinality analytics path.
 * Its arrays are grouped by a fixed time grid or product name; order rows and
 * their item snapshots never cross the database boundary. */
export interface AnalyticsCoreMetricsSource {
  currentOrders: number
  previousOrders: number
  currentSessions: number
  previousSessions: number
  currentRevenue: number
  previousRevenue: number
  currentPaidOrders: number
  previousPaidOrders: number
  sales: Array<{ period: 'current' | 'previous'; day: string; hour: number; total: number }>
  heatmap: Array<{ day: number; hour: number; count: number }>
  products: Array<{
    period: 'current' | 'previous'
    name: string
    count: number
    revenue: number
  }>
}

export interface DashboardInsightsTableRow {
  id: string
  label: string
  deletedAt: string | null
  areaLabel?: string | null
}

export interface DashboardTablePerformanceSource {
  tables: Array<{ id: string; label: string }>
  orders: Array<{ tableId: string; total: number; count?: number }>
  closedSessions: Array<{
    tableId: string
    openedAt?: string
    closedAt?: string
    turnover?: number
    dwellSumMinutes?: number
  }>
  openTableIds: string[]
}

export interface PanoOperationalSource {
  errors: string[]
  tables: DashboardInsightsTableRow[]
  openTableSessions: OpenTableSession[]
  pendingServiceRequests: Array<{
    id: string
    tableId: string
    createdAt: string
    requestType: ServiceRequestType
  }>
  paymentMode: string | null
  paymentConfigured: boolean
  /** Orders someone on the floor must act on: approve, or serve once ready. */
  actionableOrders: Array<{
    id: string
    status: 'pending' | 'pending_approval' | 'ready'
    tableId: string | null
    createdAt: string
    readyAt: string | null
    /** "2× Latte, Tiramisu" */
    summary: string
  }>
}

/** Collected revenue for the Pano business view; "same time" figures stop at the current local clock time. */
export interface PanoBusinessSource {
  today: { revenue: number; paidOrders: number; cash: number; comp: number; cancelledCount: number; cancelledTotal: number }
  yesterday: { revenue: number; paidOrders: number; sameTimeRevenue: number; sameTimePaidOrders: number }
  lastWeekDay: { revenue: number; sameTimeRevenue: number }
  hourly: { today: number[]; lastWeekDay: number[] }
  /** Busiest hour on the last four same weekdays; null without data. */
  peakHour: number | null
  period: {
    days: 7 | 30
    revenue: number
    paidOrders: number
    previousRevenue: number
    previousPaidOrders: number
    daily: Array<{ date: string; current: number; previous: number }>
  }
  /** Least sold items over 30 days, among items sold at least once. */
  lowItems: Array<{ name: string; count: number }>
  /** Stock consumed by sales against collected revenue, last 7 days. */
  foodCost: { consumption: number; revenue: number; hasSales: boolean; missingCost: boolean }
}

export interface PanoMetricsSource {
  revenue: number
  revenueYesterday: number
  orders: number
  ordersYesterday: number
  paidOrders: number
  paidOrdersYesterday: number
  activeOrders: number
  pendingOrders: number
  preparingOrders: number
  sessions: number
  sessionsYesterday: number
  hourlySales: Array<{ hour: number; total: number }>
  recentOrders: Array<{
    id: string
    status: string
    total: number
    tableId: string | null
    tableLabel: string | null
    createdAt: string
  }>
  topItems: Array<{ name: string; count: number; revenue: number }>
  heatmap: Array<{ day: number; hour: number; count: number }>
}

export interface DashboardInsightsReadModelPort {
  readAnalyticsCoreMetrics(input: {
    restaurantId: string
    since: string
    currentStart: string
    before: string
    timezone: string
    filters?: AnalyticsOrderReadFilters
  }): Promise<Result<AnalyticsCoreMetricsSource>>
  readOrderVolume(input: {
    restaurantId: string
    since: string
    before?: string
    limit?: number
    excludeCancelled?: boolean
    filters?: AnalyticsOrderReadFilters
  }): Promise<Result<DashboardOrderVolumeRow[]>>
  readCollectedOrders(input: {
    restaurantId: string
    since: string
    before?: string
    filters?: AnalyticsOrderReadFilters
  }): Promise<Result<DashboardCollectedOrderRow[]>>
  readTableRefs(input: {
    restaurantId: string
    includeDeleted?: boolean
  }): Promise<Result<DashboardInsightsTableRow[]>>
  readTablePerformance(input: {
    restaurantId: string
    since: string
    before?: string
    filters?: AnalyticsOrderReadFilters
  }): Promise<Result<DashboardTablePerformanceSource>>
  readPanoMetrics(input: {
    restaurantId: string
    todayStart: string
    yesterdayStart: string
    heatmapStart: string
    timezone: string
  }): Promise<Result<PanoMetricsSource>>
  readPanoOperationalSource(input: {
    restaurantId: string
    includePaymentStatus: boolean
  }): Promise<Result<PanoOperationalSource>>
  readPanoBusiness(input: {
    restaurantId: string
    now: string
    timezone: string
    periodDays: 7 | 30
  }): Promise<Result<PanoBusinessSource>>
}

function allowRead(
  context: DashboardActorContext,
  restaurantId: string,
  section: 'orders' | 'tables',
): Result<true> {
  return hasSameRestaurant(context, restaurantId) && context.permissions.includes(section)
    ? { ok: true, value: true }
    : err('Not authorized')
}

function allowInsightsRead(
  context: DashboardActorContext,
  restaurantId: string,
  section: DashboardInsightsSection,
): Result<true> {
  return hasSameRestaurant(context, restaurantId) && context.permissions.includes(section)
    ? { ok: true, value: true }
    : err('Not authorized')
}

export async function readOrdersBoard<TOrder>(
  context: DashboardActorContext,
  input: { restaurantId: string; since: string; pageSize?: number },
  port: OrdersBoardReadModelPort<TOrder>,
): Promise<Result<OrdersBoardReadModel<TOrder>>> {
  const access = allowRead(context, input.restaurantId, 'orders')
  return access.ok ? port.readBoard(input) : access
}

export async function readPanoTableDetail(
  context: DashboardActorContext,
  input: { restaurantId: string; tableId: string },
  port: PanoTableDetailReadModelPort,
): Promise<Result<PanoTableDetailReadModel>> {
  const access = allowRead(context, input.restaurantId, 'tables')
  return access.ok ? port.readTableDetail(input) : access
}

export async function readDashboardOrderVolume(
  context: DashboardActorContext,
  input: {
    restaurantId: string
    section: DashboardInsightsSection
    since: string
    before?: string
    limit?: number
    excludeCancelled?: boolean
    filters?: AnalyticsOrderReadFilters
  },
  port: DashboardInsightsReadModelPort,
): Promise<Result<DashboardOrderVolumeRow[]>> {
  const access = allowInsightsRead(context, input.restaurantId, input.section)
  if (!access.ok) return access
  const { section: _section, ...query } = input
  return port.readOrderVolume(query)
}

export async function readAnalyticsCoreMetrics(
  context: DashboardActorContext,
  input: {
    restaurantId: string
    since: string
    currentStart: string
    before: string
    timezone: string
    filters?: AnalyticsOrderReadFilters
  },
  port: DashboardInsightsReadModelPort,
): Promise<Result<AnalyticsCoreMetricsSource>> {
  const access = allowInsightsRead(context, input.restaurantId, 'analytics')
  return access.ok ? port.readAnalyticsCoreMetrics(input) : access
}

export async function readDashboardCollectedOrders(
  context: DashboardActorContext,
  input: { restaurantId: string; section: DashboardInsightsSection; since: string; before?: string; filters?: AnalyticsOrderReadFilters },
  port: DashboardInsightsReadModelPort,
): Promise<Result<DashboardCollectedOrderRow[]>> {
  const access = allowInsightsRead(context, input.restaurantId, input.section)
  if (!access.ok) return access
  const { section: _section, ...query } = input
  return port.readCollectedOrders(query)
}

export async function readDashboardTablePerformance(
  context: DashboardActorContext,
  input: { restaurantId: string; since: string; before?: string; filters?: AnalyticsOrderReadFilters },
  port: DashboardInsightsReadModelPort,
): Promise<Result<DashboardTablePerformanceSource>> {
  const access = allowInsightsRead(context, input.restaurantId, 'analytics')
  return access.ok ? port.readTablePerformance(input) : access
}

export async function readDashboardTableRefs(
  context: DashboardActorContext,
  input: { restaurantId: string; section: DashboardInsightsSection; includeDeleted?: boolean },
  port: DashboardInsightsReadModelPort,
): Promise<Result<DashboardInsightsTableRow[]>> {
  const access = allowInsightsRead(context, input.restaurantId, input.section)
  if (!access.ok) return access
  return port.readTableRefs(input.includeDeleted === undefined
    ? { restaurantId: input.restaurantId }
    : { restaurantId: input.restaurantId, includeDeleted: input.includeDeleted })
}

export async function readPanoOperationalSource(
  context: DashboardActorContext,
  input: { restaurantId: string; includePaymentStatus: boolean },
  port: DashboardInsightsReadModelPort,
): Promise<Result<PanoOperationalSource>> {
  const access = allowInsightsRead(context, input.restaurantId, 'pano')
  if (!access.ok) return access
  const trustedInput = {
    restaurantId: input.restaurantId,
    includePaymentStatus: context.isOwner === true && input.includePaymentStatus,
  }
  return port.readPanoOperationalSource(trustedInput)
}

/** Revenue is business data: only the owner or members with the analytics section read it. */
export async function readPanoBusiness(
  context: DashboardActorContext,
  input: { restaurantId: string; now: string; timezone: string; periodDays: 7 | 30 },
  port: DashboardInsightsReadModelPort,
): Promise<Result<PanoBusinessSource>> {
  const access = allowInsightsRead(context, input.restaurantId, 'analytics')
  return access.ok ? port.readPanoBusiness(input) : access
}

export async function readPanoMetrics(
  context: DashboardActorContext,
  input: {
    restaurantId: string
    todayStart: string
    yesterdayStart: string
    heatmapStart: string
    timezone: string
  },
  port: DashboardInsightsReadModelPort,
): Promise<Result<PanoMetricsSource>> {
  const access = allowInsightsRead(context, input.restaurantId, 'pano')
  return access.ok ? port.readPanoMetrics(input) : access
}
