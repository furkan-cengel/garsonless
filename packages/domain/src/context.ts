/**
 * A command never receives a raw restaurant id as its authority. Adapters
 * resolve one of these contexts before invoking application code.
 */
export type DashboardActorContext = {
  actor: 'dashboard-member'
  userId: string
  restaurantId: string
  permissions: readonly string[]
}

export type TableGuestContext = {
  actor: 'table-guest'
  restaurantId: string
  /** Internal table id resolved from the opaque QR token at the server edge. */
  tableId: string
  tableToken: string
  /** Device idempotency/session id; service requests do not require one. */
  sessionId?: string
}

export type KitchenActorContext = {
  actor: 'kitchen'
  restaurantId: string
  stationId: string
}

export type PaymentProviderContext = {
  actor: 'payment-provider'
  restaurantId: string
  provider: 'iyzico'
}

export type CommandContext =
  | DashboardActorContext
  | TableGuestContext
  | KitchenActorContext
  | PaymentProviderContext

export function hasSameRestaurant(context: CommandContext, restaurantId: string): boolean {
  return context.restaurantId === restaurantId
}
