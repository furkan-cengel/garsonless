import type { CommandContext, Result } from '@garsonless/domain'
import { err, hasSameRestaurant } from '@garsonless/domain'
import { isValidOrderRefundAmount } from '@garsonless/domain/orders'

export type OrderRefundMethod = 'cash' | 'pos' | 'iyzico'
export type OrderRefundKind = 'full' | 'partial'
export type OrderRefundStatus = 'pending' | 'succeeded' | 'failed' | 'pending_reconciliation'

export interface OrderRefundResult {
  id: string
  orderId: string
  restaurantId: string
  method: OrderRefundMethod
  source: 'manual' | 'provider'
  status: OrderRefundStatus
  kind: OrderRefundKind
  amount: number
  idempotencyKey: string
  providerPaymentId: string | null
  providerRefundRef: string | null
  refundedAt: string | null
  replayed: boolean
}

export interface OrderRefundPort {
  recordManual(input: {
    orderId: string
    restaurantId: string
    amount: number
    reason: string
    actorUserId: string
    idempotencyKey: string
  }): Promise<Result<OrderRefundResult>>
  reserveIyzico(input: {
    orderId: string
    restaurantId: string
    amount: number
    reason: string
    actorUserId: string
    idempotencyKey: string
  }): Promise<Result<OrderRefundResult>>
  finalizeIyzico(input: {
    refundId: string
    orderId: string
    restaurantId: string
    amount: number
    providerPaymentId: string
    providerRefundRef: string
    idempotencyKey: string
  }): Promise<Result<OrderRefundResult>>
  markIyzicoUnsuccessful(input: {
    refundId: string
    orderId: string
    restaurantId: string
    actorUserId: string
    status: 'failed' | 'pending_reconciliation'
    failureCode: string
    failureMessage: string
  }): Promise<Result<true>>
}

function validAmount(amount: number): boolean {
  return isValidOrderRefundAmount(amount)
}

function validReason(reason: string): boolean {
  const size = reason.trim().length
  return size >= 3 && size <= 200
}

function validKey(value: string): boolean {
  const size = value.trim().length
  return size >= 1 && size <= 200
}

function canOwnerRefund(
  context: Extract<CommandContext, { actor: 'dashboard-member' }>,
  restaurantId: string,
): boolean {
  return hasSameRestaurant(context, restaurantId) && context.isOwner === true
}

export async function recordManualOrderRefund(
  context: Extract<CommandContext, { actor: 'dashboard-member' }>,
  input: {
    orderId: string
    restaurantId: string
    method: 'cash' | 'pos'
    amount: number
    reason: string
    idempotencyKey: string
  },
  port: OrderRefundPort,
): Promise<Result<OrderRefundResult>> {
  if (!canOwnerRefund(context, input.restaurantId)) return err('Not authorized')
  if (input.method !== 'cash' && input.method !== 'pos') return err('Manual refunds are cash/POS only')
  if (!validAmount(input.amount) || !validReason(input.reason) || !validKey(input.idempotencyKey)) {
    return err('Invalid refund input')
  }
  return port.recordManual({
    orderId: input.orderId,
    restaurantId: input.restaurantId,
    amount: input.amount,
    reason: input.reason.trim(),
    actorUserId: context.userId,
    idempotencyKey: input.idempotencyKey.trim(),
  })
}

/** Owner may create a provider intent, but cannot mark money refunded. Only the
 * verified payment-provider callback below can move it to succeeded. */
export async function reserveIyzicoOrderRefund(
  context: Extract<CommandContext, { actor: 'dashboard-member' }>,
  input: { orderId: string; restaurantId: string; amount: number; reason: string; idempotencyKey: string },
  port: OrderRefundPort,
): Promise<Result<OrderRefundResult>> {
  if (!canOwnerRefund(context, input.restaurantId)) return err('Not authorized')
  if (!validAmount(input.amount) || !validReason(input.reason) || !validKey(input.idempotencyKey)) {
    return err('Invalid refund input')
  }
  return port.reserveIyzico({
    ...input,
    reason: input.reason.trim(),
    actorUserId: context.userId,
    idempotencyKey: input.idempotencyKey.trim(),
  })
}

export async function finalizeIyzicoOrderRefund(
  context: Extract<CommandContext, { actor: 'payment-provider' }>,
  input: {
    refundId: string
    orderId: string
    restaurantId: string
    amount: number
    providerPaymentId: string
    providerRefundRef: string
    idempotencyKey: string
  },
  port: OrderRefundPort,
): Promise<Result<OrderRefundResult>> {
  if (!hasSameRestaurant(context, input.restaurantId) || context.provider !== 'iyzico') return err('Not authorized')
  if (!validAmount(input.amount) || !validKey(input.idempotencyKey)
      || !input.providerPaymentId.trim() || !input.providerRefundRef.trim()) {
    return err('Invalid verified provider refund')
  }
  return port.finalizeIyzico({
    ...input,
    providerPaymentId: input.providerPaymentId.trim(),
    providerRefundRef: input.providerRefundRef.trim(),
    idempotencyKey: input.idempotencyKey.trim(),
  })
}

export async function markIyzicoOrderRefundUnsuccessful(
  context: Extract<CommandContext, { actor: 'dashboard-member' }>,
  input: {
    refundId: string
    orderId: string
    restaurantId: string
    status: 'failed' | 'pending_reconciliation'
    failureCode: string
    failureMessage: string
  },
  port: OrderRefundPort,
): Promise<Result<true>> {
  if (!canOwnerRefund(context, input.restaurantId)) return err('Not authorized')
  return port.markIyzicoUnsuccessful({ ...input, actorUserId: context.userId })
}
