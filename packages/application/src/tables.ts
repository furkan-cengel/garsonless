import type {
  CommandContext,
  Result,
  ServiceRequestType,
  TableSessionCloseOutcome,
} from '@garsonless/domain'
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

function requireDashboardTables(
  context: Extract<CommandContext, { actor: 'dashboard-member' }>,
  restaurantId: string,
): Result<true> {
  if (!hasSameRestaurant(context, restaurantId) || !context.permissions.includes('tables')) {
    return err('Not authorized')
  }
  return ok(true)
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

export interface KitchenBoardPort<TRestaurant, TOrder, TStation> {
  readBoard(restaurantId: string): Promise<Result<{
    restaurant: TRestaurant | null
    orders: TOrder[]
    tableLabels: Record<string, string>
    stations: TStation[]
  }>>
  readOrder(input: { orderId: string; restaurantId: string }): Promise<Result<TOrder | null>>
  listOrders(restaurantId: string): Promise<Result<TOrder[]>>
}

export async function readKitchenBoard<TRestaurant, TOrder, TStation>(
  context: Extract<CommandContext, { actor: 'kitchen' }>,
  restaurantId: string,
  port: KitchenBoardPort<TRestaurant, TOrder, TStation>,
) {
  return hasSameRestaurant(context, restaurantId)
    ? port.readBoard(restaurantId)
    : err('Not authorized')
}

export async function readKitchenOrder<TRestaurant, TOrder, TStation>(
  context: Extract<CommandContext, { actor: 'kitchen' }>,
  input: { orderId: string; restaurantId: string },
  port: KitchenBoardPort<TRestaurant, TOrder, TStation>,
) {
  return hasSameRestaurant(context, input.restaurantId)
    ? port.readOrder(input)
    : err('Not authorized')
}

export async function listKitchenOrders<TRestaurant, TOrder, TStation>(
  context: Extract<CommandContext, { actor: 'kitchen' }>,
  restaurantId: string,
  port: KitchenBoardPort<TRestaurant, TOrder, TStation>,
) {
  return hasSameRestaurant(context, restaurantId)
    ? port.listOrders(restaurantId)
    : err('Not authorized')
}
