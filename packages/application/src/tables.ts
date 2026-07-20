import type {
  CommandContext,
  OrderStatus,
  Result,
  ServiceRequestType,
  TableSessionCloseOutcome,
} from '@garsonless/domain'
import { authorizeDashboardFeatureRead } from './dashboard-feature-read-models'
import {
  err,
  hasSameRestaurant,
  normalizeAbnormalCloseReason,
  ok,
} from '@garsonless/domain'

export interface OpenTableSession {
  sessionId: string
  tableId: string
  openedAt: string
  total: number
  unpaidTotal: number
  splitSettledTotal: number
  splitDeclaredCashTotal: number
  orderCount: number
  hasUnfinished: boolean
}

export interface PendingTableServiceRequest {
  id: string
  tableId: string
  createdAt: string
  requestType: ServiceRequestType
  label: string
}

export interface TableSessionPort {
  closeSession(input: {
    sessionId: string
    restaurantId: string
    abnormalReason: string | null
  }): Promise<Result<TableSessionCloseOutcome>>
  listOpenSessions(restaurantId: string): Promise<Result<OpenTableSession[]>>
}

export interface TableServiceRequestPort {
  createRequest(input: {
    restaurantId: string
    tableId: string
    requestType: ServiceRequestType
  }): Promise<Result<{ throttled: boolean }>>
  resolveRequest(input: {
    requestId: string
    restaurantId: string
  }): Promise<Result<null>>
  listPendingRequests(restaurantId: string): Promise<Result<PendingTableServiceRequest[]>>
}

export type DeleteTableOutcome = 'deleted' | 'open_session' | 'not_found'

export interface DashboardTablePort {
  createTable(input: {
    restaurantId: string
    label: string
  }): Promise<Result<{ id: string; token: string }>>
  renameTable(input: {
    restaurantId: string
    tableId: string
    label: string
  }): Promise<Result<null>>
  deleteTable(input: {
    restaurantId: string
    tableId: string
  }): Promise<Result<DeleteTableOutcome>>
  listQrTokens(restaurantId: string): Promise<Result<Record<string, string>>>
  rotateQrToken(input: {
    restaurantId: string
    tableId: string
    revokedBy: string
  }): Promise<Result<string | null>>
  readRestaurantSlug(restaurantId: string): Promise<Result<string | null>>
  patchQrStyle(input: {
    restaurantId: string
    style: unknown
  }): Promise<Result<null>>
}

export interface DashboardTablesReadModelPort<TTable> {
  readTables(input: { restaurantId: string; operation: 'tables.list' }): Promise<Result<TTable[]>>
}

export interface PublicTableContext {
  restaurantId: string
  restaurantSlug: string
  tableId: string
  tableLabel: string
}

export interface PublicTableState {
  token: PublicTableContext
  session: { id: string; opened_at: string } | null
  orders: Array<{
    id: string
    status: string
    total: number
    paid_at: string | null
    created_at: string
    items: unknown
  }>
  shares: Array<{
    id: string
    amount: number
    method: string | null
    status: string
    label: string | null
  }>
}

export interface PublicTableQueryPort {
  resolveContext(token: string): Promise<Result<PublicTableContext | null>>
  readState(token: string): Promise<Result<PublicTableState | null>>
  readOrderStatus(input: {
    token: string
    sessionId: string
    orderId: string
  }): Promise<Result<{ status: string; paid_at: string | null } | null>>
}

function requireDashboardTables(
  context: Extract<CommandContext, { actor: 'dashboard-member' }>,
  restaurantId: string,
): Result<true> {
  if (!hasSameRestaurant(context, restaurantId) || !context.permissions.includes('tables')) {
    return err('Not authorized')
  }
  return ok(true)
}

export async function readDashboardTables<TTable>(
  context: Extract<CommandContext, { actor: 'dashboard-member' }>,
  restaurantId: string,
  port: DashboardTablesReadModelPort<TTable>,
): Promise<Result<TTable[]>> {
  const access = authorizeDashboardFeatureRead(context, restaurantId, 'tables.list')
  return access.ok ? port.readTables({ restaurantId, operation: 'tables.list' }) : access
}

export async function createDashboardTable(
  context: Extract<CommandContext, { actor: 'dashboard-member' }>,
  input: { restaurantId: string; label: string },
  port: DashboardTablePort,
): Promise<Result<{ id: string; token: string }>> {
  const access = requireDashboardTables(context, input.restaurantId)
  return access.ok ? port.createTable(input) : access
}

export async function renameDashboardTable(
  context: Extract<CommandContext, { actor: 'dashboard-member' }>,
  input: { restaurantId: string; tableId: string; label: string },
  port: DashboardTablePort,
): Promise<Result<null>> {
  const access = requireDashboardTables(context, input.restaurantId)
  return access.ok ? port.renameTable(input) : access
}

export async function deleteDashboardTable(
  context: Extract<CommandContext, { actor: 'dashboard-member' }>,
  input: { restaurantId: string; tableId: string },
  port: DashboardTablePort,
): Promise<Result<DeleteTableOutcome>> {
  const access = requireDashboardTables(context, input.restaurantId)
  return access.ok ? port.deleteTable(input) : access
}

export async function listDashboardTableQrTokens(
  context: Extract<CommandContext, { actor: 'dashboard-member' }>,
  restaurantId: string,
  port: DashboardTablePort,
): Promise<Result<Record<string, string>>> {
  const access = requireDashboardTables(context, restaurantId)
  return access.ok ? port.listQrTokens(restaurantId) : access
}

export async function rotateDashboardTableQrToken(
  context: Extract<CommandContext, { actor: 'dashboard-member' }>,
  input: { restaurantId: string; tableId: string },
  port: DashboardTablePort,
): Promise<Result<string | null>> {
  const access = requireDashboardTables(context, input.restaurantId)
  return access.ok
    ? port.rotateQrToken({ ...input, revokedBy: context.userId })
    : access
}

export async function saveDashboardQrStyle(
  context: Extract<CommandContext, { actor: 'dashboard-member' }>,
  input: {
    restaurantId: string
    style: unknown
    baseUrl: string
    menuOrigin: string
  },
  port: DashboardTablePort,
): Promise<Result<null>> {
  const access = requireDashboardTables(context, input.restaurantId)
  if (!access.ok) return access

  const slug = await port.readRestaurantSlug(input.restaurantId)
  if (!slug.ok) return slug
  if (!slug.value) return err('Restaurant not found')
  const expectedBaseUrl = `${input.menuOrigin.replace(/\/+$/, '')}/${slug.value}`
  if (input.baseUrl !== expectedBaseUrl) return err('QR menu address cannot be changed')
  return port.patchQrStyle({ restaurantId: input.restaurantId, style: input.style })
}

export async function resolvePublicTableContext(
  token: string,
  port: PublicTableQueryPort,
): Promise<Result<PublicTableContext | null>> {
  return port.resolveContext(token)
}

export async function readPublicTableState(
  token: string,
  port: PublicTableQueryPort,
): Promise<Result<PublicTableState | null>> {
  return port.readState(token)
}

export async function readPublicTableOrderStatus(
  input: { token: string; sessionId: string; orderId: string },
  port: PublicTableQueryPort,
): Promise<Result<{ status: string; paid_at: string | null } | null>> {
  return port.readOrderStatus(input)
}

export async function closeTableSession(
  context: Extract<CommandContext, { actor: 'dashboard-member' }>,
  input: { sessionId: string; restaurantId: string; abnormalReason?: string },
  port: TableSessionPort,
): Promise<Result<TableSessionCloseOutcome>> {
  const access = requireDashboardTables(context, input.restaurantId)
  if (!access.ok) return access
  const reason = normalizeAbnormalCloseReason(input.abnormalReason)
  if (!reason.ok) return reason
  return port.closeSession({
    sessionId: input.sessionId,
    restaurantId: input.restaurantId,
    abnormalReason: reason.value,
  })
}

export async function listOpenTableSessions(
  context: Extract<CommandContext, { actor: 'dashboard-member' }>,
  restaurantId: string,
  port: TableSessionPort,
): Promise<Result<OpenTableSession[]>> {
  const access = requireDashboardTables(context, restaurantId)
  return access.ok ? port.listOpenSessions(restaurantId) : access
}

export async function requestTableService(
  context: Extract<CommandContext, { actor: 'table-guest' }>,
  input: {
    restaurantId: string
    tableId: string
    tableToken: string
    requestType: ServiceRequestType
  },
  port: TableServiceRequestPort,
): Promise<Result<{ throttled: boolean }>> {
  if (
    !hasSameRestaurant(context, input.restaurantId)
    || context.tableId !== input.tableId
    || context.tableToken !== input.tableToken
  ) {
    return err('Invalid table context')
  }
  return port.createRequest(input)
}

export async function resolveTableServiceRequest(
  context: Extract<CommandContext, { actor: 'dashboard-member' }>,
  input: { requestId: string; restaurantId: string },
  port: TableServiceRequestPort,
): Promise<Result<null>> {
  const access = requireDashboardTables(context, input.restaurantId)
  return access.ok ? port.resolveRequest(input) : access
}

export async function listPendingTableServiceRequests(
  context: Extract<CommandContext, { actor: 'dashboard-member' }>,
  restaurantId: string,
  port: TableServiceRequestPort,
): Promise<Result<PendingTableServiceRequest[]>> {
  const access = requireDashboardTables(context, restaurantId)
  return access.ok ? port.listPendingRequests(restaurantId) : access
}

export interface KitchenRestaurantProjection {
  id: string
  name: string
  slug: string
  logo_url: string | null
}

export interface KitchenStationProjection {
  id: string
  name: string
  color: string
  position: number
}

/** Deliberately excludes totals, customer identity, payment details, request
 * ids and settlement metadata. This is the complete browser-visible KDS row. */
export interface KitchenOrderProjection {
  id: string
  status: OrderStatus
  table_id: string | null
  items: unknown
  customer_tier: unknown
  paid_at: string | null
  created_at: string
  updated_at: string
  active: boolean
}

export interface KitchenOrderProjectionBatch {
  cursor: string
  snapshot: boolean
  orders: KitchenOrderProjection[]
}

export interface KitchenBoardPort {
  readBoard(restaurantId: string): Promise<Result<{
    restaurant: KitchenRestaurantProjection | null
    orderBatch: KitchenOrderProjectionBatch
    tableLabels: Record<string, string>
    stations: KitchenStationProjection[]
  }>>
  readOrders(input: {
    restaurantId: string
    after: string | null
  }): Promise<Result<KitchenOrderProjectionBatch>>
}

export async function readKitchenBoard(
  context: Extract<CommandContext, { actor: 'kitchen' }>,
  restaurantId: string,
  port: KitchenBoardPort,
) {
  return hasSameRestaurant(context, restaurantId)
    ? port.readBoard(restaurantId)
    : err('Not authorized')
}

export async function readKitchenOrders(
  context: Extract<CommandContext, { actor: 'kitchen' }>,
  input: { restaurantId: string; after: string | null },
  port: KitchenBoardPort,
) {
  return hasSameRestaurant(context, input.restaurantId)
    ? port.readOrders(input)
    : err('Not authorized')
}

/** Snapshot replaces the board. Delta batches upsert active rows and carry
 * terminal/deleted tombstones so cards cannot linger after leaving KDS. */
export function mergeKitchenOrderProjection(
  current: readonly KitchenOrderProjection[],
  batch: KitchenOrderProjectionBatch,
): KitchenOrderProjection[] {
  if (batch.snapshot) return batch.orders.filter((order) => order.active)

  const merged = new Map(current.map((order) => [order.id, order]))
  for (const order of batch.orders) {
    if (order.active) merged.set(order.id, order)
    else merged.delete(order.id)
  }
  return [...merged.values()]
}
