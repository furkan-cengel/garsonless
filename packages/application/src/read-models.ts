import type { DashboardActorContext, Result } from '@garsonless/domain'
import { err, hasSameRestaurant } from '@garsonless/domain'

export interface OrdersBoardTableRef {
  id: string
  label: string
}

export interface OrdersBoardReadModel<TOrder> {
  orders: TOrder[]
  tables: OrdersBoardTableRef[]
  kitchenToken: string | null
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

function allowRead(
  context: DashboardActorContext,
  restaurantId: string,
  section: 'orders' | 'tables',
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
