import type { DashboardActorContext, Result } from '@garsonless/domain'
import { err, hasSameRestaurant } from '@garsonless/domain'

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
}

export interface AnalyticsCancellationOrderRow {
  total: number | null
  status: string
  items: unknown
  createdAt: string
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

export interface AnalyticsStaffMemberRow {
  userId: string | null
  email: string
  permissions: string[]
}

export interface AnalyticsLoyaltyRow {
  type: string
  direction: string
  delta: number
  reason: string
}

export interface AnalyticsReadModelPort {
  readPaymentOrders(input: { restaurantId: string; since: string }): Promise<Result<AnalyticsPaymentOrderRow[]>>
  readCancellationOrders(input: { restaurantId: string; since: string }): Promise<Result<AnalyticsCancellationOrderRow[]>>
  readAbnormalCloseData(input: { restaurantId: string; since: string }): Promise<Result<{
    sessions: AnalyticsAbnormalSessionRow[]
    unpaidOrders: AnalyticsUnpaidOrderRow[]
    tableLabels: Record<string, string>
  }>>
  readStaffSettlementData(input: { restaurantId: string; since: string }): Promise<Result<{
    orders: AnalyticsStaffOrderRow[]
    ownerId: string | null
    ownerEmail: string | null
    members: AnalyticsStaffMemberRow[]
  }>>
  readLoyaltyRows(input: { restaurantId: string; since: string }): Promise<Result<AnalyticsLoyaltyRow[]>>
}

export type DashboardInsightsSection = 'pano' | 'analytics'

export const DASHBOARD_INSIGHTS_OPERATIONS = [
  'order-volume',
  'collected-orders',
  'table-refs',
  'table-performance',
  'pano-operational',
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

export interface DashboardInsightsTableRow {
  id: string
  label: string
  deletedAt: string | null
}

export interface DashboardTablePerformanceSource {
  tables: Array<{ id: string; label: string }>
  orders: Array<{ tableId: string; total: number }>
  closedSessions: Array<{ tableId: string; openedAt: string; closedAt: string }>
  openTableIds: string[]
}

export interface PanoOperationalSource {
  errors: string[]
  tables: DashboardInsightsTableRow[]
  openSessions: Array<{ id: string; tableId: string; openedAt: string }>
  openSessionOrders: Array<{
    tableSessionId: string | null
    status: string
    total: number
    paidAt: string | null
    createdAt: string
  }>
  sessionOpenings: Array<{ id: string; openedAt: string }>
  activeOrderCount: number
  paymentMode: string | null
  paymentConfigured: boolean
}

export interface DashboardInsightsReadModelPort {
  readOrderVolume(input: {
    restaurantId: string
    since: string
    before?: string
    limit?: number
    excludeCancelled?: boolean
  }): Promise<Result<DashboardOrderVolumeRow[]>>
  readCollectedOrders(input: {
    restaurantId: string
    since: string
    before?: string
  }): Promise<Result<DashboardCollectedOrderRow[]>>
  readTableRefs(input: {
    restaurantId: string
    includeDeleted?: boolean
  }): Promise<Result<DashboardInsightsTableRow[]>>
  readTablePerformance(input: {
    restaurantId: string
    since: string
  }): Promise<Result<DashboardTablePerformanceSource>>
  readPanoOperationalSource(input: {
    restaurantId: string
    sessionSince?: string
    includePaymentStatus: boolean
  }): Promise<Result<PanoOperationalSource>>
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
  },
  port: DashboardInsightsReadModelPort,
): Promise<Result<DashboardOrderVolumeRow[]>> {
  const access = allowInsightsRead(context, input.restaurantId, input.section)
  if (!access.ok) return access
  const { section: _section, ...query } = input
  return port.readOrderVolume(query)
}

export async function readDashboardCollectedOrders(
  context: DashboardActorContext,
  input: { restaurantId: string; section: DashboardInsightsSection; since: string; before?: string },
  port: DashboardInsightsReadModelPort,
): Promise<Result<DashboardCollectedOrderRow[]>> {
  const access = allowInsightsRead(context, input.restaurantId, input.section)
  if (!access.ok) return access
  const { section: _section, ...query } = input
  return port.readCollectedOrders(query)
}

export async function readDashboardTablePerformance(
  context: DashboardActorContext,
  input: { restaurantId: string; since: string },
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
  input: { restaurantId: string; sessionSince?: string; includePaymentStatus: boolean },
  port: DashboardInsightsReadModelPort,
): Promise<Result<PanoOperationalSource>> {
  const access = allowInsightsRead(context, input.restaurantId, 'pano')
  if (!access.ok) return access
  const trustedInput = {
    restaurantId: input.restaurantId,
    includePaymentStatus: context.isOwner === true && input.includePaymentStatus,
    ...(input.sessionSince === undefined ? {} : { sessionSince: input.sessionSince }),
  }
  return port.readPanoOperationalSource(trustedInput)
}
