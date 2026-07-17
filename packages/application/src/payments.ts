import type { CommandContext, Result } from '@garsonless/domain'
import { err, hasSameRestaurant, ok } from '@garsonless/domain'

export interface OrderCheckoutPort {
  reserveOrderCheckout(input: {
    restaurantId: string
    tableId: string
    orderId: string
  }): Promise<Result<{ amount: number; restaurantSettings: unknown; reservationId: string }>>
  releaseOrderCheckout(input: {
    restaurantId: string
    orderId: string
    reservationId: string
  }): Promise<Result<true>>
}

/** Owns the single-order checkout preflight. The client total is deliberately
 * absent: the repository returns the persisted post-discount amount. */
export async function prepareOrderCheckout(
  context: Extract<CommandContext, { actor: 'table-guest' }>,
  input: { restaurantId: string; orderId: string },
  port: OrderCheckoutPort,
): Promise<Result<{ amount: number; restaurantSettings: unknown; reservationId: string }>> {
  if (!hasSameRestaurant(context, input.restaurantId)) return err('Invalid table context')
  const checkout = await port.reserveOrderCheckout({
    ...input,
    tableId: context.tableId,
  })
  if (!checkout.ok) return checkout
  const amount = Math.round(checkout.value.amount * 100) / 100
  if (!(amount > 0)) return err('Geçersiz tutar')
  return ok({ ...checkout.value, amount })
}

/** Releases only the lease created by this request. Once a provider token is
 * attached the repository refuses release, because money may still arrive. */
export async function releaseOrderCheckout(
  context: Extract<CommandContext, { actor: 'table-guest' }>,
  input: { restaurantId: string; orderId: string; reservationId: string },
  port: OrderCheckoutPort,
): Promise<Result<true>> {
  if (!hasSameRestaurant(context, input.restaurantId)) return err('Invalid table context')
  return port.releaseOrderCheckout(input)
}
