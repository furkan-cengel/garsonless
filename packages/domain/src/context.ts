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
  tableToken: string
  sessionId: string
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
