/**
 * A command never receives a raw restaurant id as its authority. Adapters
 * resolve one of these contexts before invoking application code.
 */
export type DashboardActorContext = {
  actor: 'dashboard-member'
  userId: string
  restaurantId: string
  permissions: readonly string[]
  /** Explicit authority resolved by the dashboard adapter. Missing means member. */
  isOwner?: boolean
}

/** Authenticated dashboard identity before a restaurant has been selected.
 * Portfolio reads may use this context; tenant-bound reads must first resolve
 * a DashboardActorContext. */
export type DashboardUserContext = {
  actor: 'dashboard-user'
  userId: string
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

export type CustomerActorContext = {
  actor: 'customer-member'
  authUserId: string
  customerId: string
  restaurantId: string
}

export type CommandContext =
  | DashboardActorContext
  | TableGuestContext
  | KitchenActorContext
  | PaymentProviderContext
  | CustomerActorContext

export function hasSameRestaurant(context: CommandContext, restaurantId: string): boolean {
  return context.restaurantId === restaurantId
}
