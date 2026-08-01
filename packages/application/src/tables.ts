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

export interface TableTransferHistoryItem {
  id: string
  kind: 'table_move' | 'account_transfer' | 'item_transfer'
  sourceTableId: string
  targetTableId: string
  sourceSessionId: string
  targetSessionId: string
  status: 'active' | 'undone' | 'locked'
  requestId: string
  sourceSessionClosed: boolean
  targetSessionCreated: boolean
  createdBy: string
  createdAt: string
  undoneBy: string | null
  undoneAt: string | null
  lockReason: string | null
  orderCount: number
}

export type TableTransferKind = TableTransferHistoryItem['kind']
export type TableTransferOutcome = { operationId: string; idempotent: boolean; error?: string }

export interface TableOrderItemTransferSelection {
  orderId: string
  lineIndex: number
  quantity: number
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
  moveSession(input: { restaurantId: string; sourceTableId: string; targetTableId: string; actorId: string; requestId: string }): Promise<Result<TableTransferOutcome>>
  transferOrders(input: { restaurantId: string; sourceTableId: string; targetTableId: string; orderIds: string[]; actorId: string; requestId: string }): Promise<Result<TableTransferOutcome>>
  transferOrderItems(input: { restaurantId: string; sourceTableId: string; targetTableId: string; selections: TableOrderItemTransferSelection[]; actorId: string; requestId: string }): Promise<Result<TableTransferOutcome>>
  readTransferKind(input: { restaurantId: string; operationId: string }): Promise<Result<TableTransferKind | null>>
  undoTransfer(input: { restaurantId: string; operationId: string; actorId: string }): Promise<Result<TableTransferOutcome>>
  listTransferHistory(restaurantId: string): Promise<Result<TableTransferHistoryItem[]>>
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

export type DashboardTableCreateOutcome =
  | { kind: 'created'; id: string; token: string }
  | { kind: 'plan_limit'; limit: number }

export interface DashboardQrStyleSnapshot {
  revision: number
  style: unknown
}

export type DashboardQrStylePatchOutcome =
  | { kind: 'saved'; snapshot: DashboardQrStyleSnapshot }
  | { kind: 'conflict'; snapshot: DashboardQrStyleSnapshot }

export type TableLayoutShape = 'square' | 'rectangle'
export type TableLayoutRotation = 0 | 90

export interface TableLayoutEntry {
  tableId: string
  xBp: number | null
  yBp: number | null
  shape: TableLayoutShape
  rotation: TableLayoutRotation
  seatCount: number
}

export interface TableLayoutWriteEntry extends Omit<TableLayoutEntry, 'xBp' | 'yBp'> {
  xBp: number
  yBp: number
}

export interface TableLayoutSnapshot {
  revision: number
  initializedAt: string | null
  entries: TableLayoutEntry[]
}

export type TableLayoutSaveOutcome =
  | { kind: 'saved'; idempotent: boolean; snapshot: TableLayoutSnapshot }
  | { kind: 'conflict'; idempotent: false; snapshot: TableLayoutSnapshot }

export interface DashboardTablePort {
  createTable(input: {
    restaurantId: string
    label: string
    floorLabel?: string | null
    areaLabel?: string | null
  }): Promise<Result<DashboardTableCreateOutcome>>
  renameTable(input: {
    restaurantId: string
    tableId: string
    label: string
    floorLabel?: string | null
    areaLabel?: string | null
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
    requestId: string
  }): Promise<Result<string | null>>
  readRestaurantSlug(restaurantId: string): Promise<Result<string | null>>
  patchQrStyle(input: {
    restaurantId: string
    style: unknown
    expectedRevision: number
  }): Promise<Result<DashboardQrStylePatchOutcome>>
  readLayout(restaurantId: string): Promise<Result<TableLayoutSnapshot | null>>
  saveLayout(input: {
    restaurantId: string
    expectedRevision: number
    requestId: string
    actorId: string
    entries: TableLayoutWriteEntry[]
  }): Promise<Result<TableLayoutSaveOutcome>>
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
  input: { restaurantId: string; label: string; floorLabel?: string | null; areaLabel?: string | null },
  port: DashboardTablePort,
): Promise<Result<DashboardTableCreateOutcome>> {
  const access = requireDashboardTables(context, input.restaurantId)
  return access.ok ? port.createTable(input) : access
}

export async function renameDashboardTable(
  context: Extract<CommandContext, { actor: 'dashboard-member' }>,
  input: { restaurantId: string; tableId: string; label: string; floorLabel?: string | null; areaLabel?: string | null },
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
  input: { restaurantId: string; tableId: string; requestId: string },
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
    expectedRevision: number
  },
  port: DashboardTablePort,
): Promise<Result<DashboardQrStylePatchOutcome>> {
  const access = requireDashboardTables(context, input.restaurantId)
  if (!access.ok) return access

  return port.patchQrStyle({
    restaurantId: input.restaurantId,
    style: input.style,
    expectedRevision: input.expectedRevision,
  })
}

export async function readDashboardTableLayout(
  context: Extract<CommandContext, { actor: 'dashboard-member' }>,
  restaurantId: string,
  port: DashboardTablePort,
): Promise<Result<TableLayoutSnapshot | null>> {
  const access = requireDashboardTables(context, restaurantId)
  return access.ok ? port.readLayout(restaurantId) : access
}

export async function saveDashboardTableLayout(
  context: Extract<CommandContext, { actor: 'dashboard-member' }>,
  input: {
    restaurantId: string
    expectedRevision: number
    requestId: string
    entries: TableLayoutWriteEntry[]
  },
  port: DashboardTablePort,
): Promise<Result<TableLayoutSaveOutcome>> {
  const access = requireDashboardTables(context, input.restaurantId)
  if (!access.ok) return access
  return port.saveLayout({ ...input, actorId: context.userId })
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

export async function moveTableSession(
  context: Extract<CommandContext, { actor: 'dashboard-member' }>,
  input: { restaurantId: string; sourceTableId: string; targetTableId: string; requestId: string },
  port: TableSessionPort,
): Promise<Result<TableTransferOutcome>> {
  const access = requireDashboardTables(context, input.restaurantId)
  return access.ok ? port.moveSession({ ...input, actorId: context.userId }) : access
}

export async function transferTableOrders(
  context: Extract<CommandContext, { actor: 'dashboard-member' }>,
  input: { restaurantId: string; sourceTableId: string; targetTableId: string; orderIds: string[]; requestId: string },
  port: TableSessionPort,
): Promise<Result<TableTransferOutcome>> {
  if (!hasSameRestaurant(context, input.restaurantId) || !context.permissions.includes('orders')) return err('Not authorized')
  if (input.orderIds.length === 0 || new Set(input.orderIds).size !== input.orderIds.length) return err('Geçerli sipariş seçin.')
  return port.transferOrders({ ...input, actorId: context.userId })
}

export async function transferTableOrderItems(
  context: Extract<CommandContext, { actor: 'dashboard-member' }>,
  input: { restaurantId: string; sourceTableId: string; targetTableId: string; selections: TableOrderItemTransferSelection[]; requestId: string },
  port: TableSessionPort,
): Promise<Result<TableTransferOutcome>> {
  if (!hasSameRestaurant(context, input.restaurantId) || !context.permissions.includes('orders')) return err('Not authorized')
  if (input.selections.length === 0 || input.selections.length > 500) return err('Geçerli ürün seçin.')
  const keys = new Set<string>()
  for (const selection of input.selections) {
    if (!selection.orderId || !Number.isInteger(selection.lineIndex) || selection.lineIndex < 0
      || !Number.isInteger(selection.quantity) || selection.quantity < 1 || selection.quantity > 99) {
      return err('Geçersiz ürün seçimi.')
    }
    const key = `${selection.orderId}:${selection.lineIndex}`
    if (keys.has(key)) return err('Aynı ürün satırı birden fazla kez seçilemez.')
    keys.add(key)
  }
  return port.transferOrderItems({ ...input, actorId: context.userId })
}

export async function undoTableTransfer(
  context: Extract<CommandContext, { actor: 'dashboard-member' }>,
  input: { restaurantId: string; operationId: string },
  port: TableSessionPort,
): Promise<Result<TableTransferOutcome>> {
  if (!hasSameRestaurant(context, input.restaurantId)) return err('Not authorized')

  const kind = await port.readTransferKind(input)
  if (!kind.ok) return kind
  if (!kind.value) return err('Taşıma işlemi bulunamadı.')

  const requiredPermission = kind.value === 'table_move' ? 'tables' : 'orders'
  if (!context.permissions.includes(requiredPermission)) return err('Not authorized')
  return port.undoTransfer({ restaurantId: input.restaurantId, operationId: input.operationId, actorId: context.userId })
}

export async function listTableTransferHistory(
  context: Extract<CommandContext, { actor: 'dashboard-member' }>, restaurantId: string, port: TableSessionPort,
): Promise<Result<TableTransferHistoryItem[]>> {
  if (!hasSameRestaurant(context, restaurantId) || !context.permissions.some((permission) => permission === 'tables' || permission === 'orders')) return err('Not authorized')
  return port.listTransferHistory(restaurantId)
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
