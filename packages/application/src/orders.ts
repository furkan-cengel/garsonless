import type { CommandContext, OrderStatus, PaymentMethod, Result } from '@garsonless/domain'
import { err, hasSameRestaurant, ok } from '@garsonless/domain'

export interface PublicOrderLine {
  itemId: string
  quantity: number
  selectedModifiers?: Array<{ group_id: string; option_id: string; quantity?: number }>
  removedIngredientIds?: string[]
}

export interface PlacePublicOrderCommand {
  restaurantId: string
  slug: string
  /** Opaque, revocable public credential; supplied by the QR route. */
  tableToken: string
  /** Resolved server-side from tableToken, never accepted from the HTTP body. */
  tableId: string
  sessionId: string
  requestId: string
  lines: PublicOrderLine[]
  customerId: string | null
  redeemPoints: number
  redeemStampClaim: boolean
  catalogItemId: string | null
  rateLimitKey: string
}

export interface PlacePublicOrderResult {
  orderId: string
  breakdown: unknown
}

/** Infrastructure port: application code neither imports Supabase nor sees its client. */
export interface PublicOrderPort {
  resolveRestaurantIdBySlug(slug: string): Promise<string | null>
  consumeRateLimit(input: { restaurantId: string; keyHash: string; max: number; windowSeconds: number }): Promise<Result<true>>
  createOrder(input: Omit<PlacePublicOrderCommand, 'slug' | 'rateLimitKey'>): Promise<Result<PlacePublicOrderResult>>
}

export async function placePublicOrder(
  context: Extract<CommandContext, { actor: 'table-guest' }>,
  command: PlacePublicOrderCommand,
  port: PublicOrderPort,
): Promise<Result<PlacePublicOrderResult>> {
  if (
    !hasSameRestaurant(context, command.restaurantId)
    || context.tableId !== command.tableId
    || context.tableToken !== command.tableToken
    || context.sessionId !== command.sessionId
  ) {
    return err('Invalid table context')
  }

  const resolvedRestaurantId = await port.resolveRestaurantIdBySlug(command.slug)
  if (resolvedRestaurantId !== command.restaurantId) return err('Restaurant mismatch')

  const rateLimit = await port.consumeRateLimit({
    restaurantId: command.restaurantId,
    keyHash: command.rateLimitKey,
    max: 8,
    windowSeconds: 60,
  })
  if (!rateLimit.ok) return rateLimit

  return port.createOrder({
    restaurantId: command.restaurantId,
    tableToken: command.tableToken,
    tableId: command.tableId,
    sessionId: command.sessionId,
    requestId: command.requestId,
    lines: command.lines,
    customerId: command.customerId,
    redeemPoints: command.redeemPoints,
    redeemStampClaim: command.redeemStampClaim,
    catalogItemId: command.catalogItemId,
  })
}

export interface SettlementPort {
  settleOrder(input: { orderId: string; restaurantId: string; method: PaymentMethod; settledBy: string | null }): Promise<Result<null>>
}

export async function settleOrder(
  context: Extract<CommandContext, { actor: 'dashboard-member' | 'payment-provider' }>,
  input: { orderId: string; restaurantId: string; method: PaymentMethod },
  port: SettlementPort,
): Promise<Result<null>> {
  if (!hasSameRestaurant(context, input.restaurantId)) return err('Not authorized')
  if (context.actor === 'dashboard-member' && input.method === 'iyzico') return err('Online settlement is provider-only')
  if (context.actor === 'payment-provider' && input.method !== 'iyzico') return err('Invalid provider settlement method')
  return port.settleOrder({
    ...input,
    settledBy: context.actor === 'dashboard-member' ? context.userId : null,
  })
}

export function allowDashboardSection(context: Extract<CommandContext, { actor: 'dashboard-member' }>, section: string): Result<true> {
  return context.permissions.includes(section) ? ok(true) : err('Not authorized')
}

export interface KitchenOrderSnapshot {
  id: string
  status: OrderStatus
  stationIds: string[]
}

export interface KitchenOrderPort {
  getOrder(input: { orderId: string; restaurantId: string }): Promise<KitchenOrderSnapshot | null>
  updateStatus(input: { orderId: string; restaurantId: string; status: OrderStatus }): Promise<Result<null>>
}

/**
 * KDS may prepare and complete food, but cannot serve/cancel. The restaurant
 * and station are already verified by the adapter; this command owns the
 * transition and multi-station policy in one testable location.
 */
export async function transitionKitchenOrder(
  context: Extract<CommandContext, { actor: 'kitchen' }>,
  input: { orderId: string; restaurantId: string; status: 'preparing' | 'ready' },
  port: KitchenOrderPort,
): Promise<Result<null>> {
  if (!hasSameRestaurant(context, input.restaurantId)) return err('Not authorized')

  const order = await port.getOrder({ orderId: input.orderId, restaurantId: input.restaurantId })
  if (!order) return err('Order not found')

  const canStart = input.status === 'preparing'
    && ['pending', 'pending_approval', 'sent_to_kitchen', 'paid'].includes(order.status)
  const canFinish = input.status === 'ready' && order.status === 'preparing'
  if (!canStart && !canFinish) return err('Invalid kitchen status transition')

  const stationIds = new Set(order.stationIds)
  if (context.stationId !== 'expo') {
    if (!stationIds.has(context.stationId)) return err('Order does not belong to this station')
    if (input.status === 'ready' && (stationIds.size !== 1 || !stationIds.has(context.stationId))) {
      return err('Çok istasyonlu siparişi Son Kontrol tamamlar')
    }
  }

  return port.updateStatus({ ...input })
}
