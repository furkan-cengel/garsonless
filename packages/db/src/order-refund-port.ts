import type { OrderRefundPort, OrderRefundResult } from '@garsonless/application/refunds'
import { err, ok, type Result } from '@garsonless/domain/result'
import { createServiceClient } from './service-client'

type Rpc = (name: string, args: Record<string, unknown>) => Promise<{
  data: unknown
  error: { message: string } | null
}>

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function normalizeRefund(value: unknown): Result<OrderRefundResult> {
  const row = object(value)
  if (!row || typeof row.id !== 'string' || typeof row.order_id !== 'string'
      || typeof row.restaurant_id !== 'string' || typeof row.payment_method !== 'string'
      || typeof row.source !== 'string' || typeof row.status !== 'string'
      || typeof row.kind !== 'string' || typeof row.amount !== 'number'
      || typeof row.idempotency_key !== 'string') {
    return err('İade kayıt cevabı geçersiz')
  }
  if (!['cash', 'pos', 'iyzico'].includes(row.payment_method)
      || !['manual', 'provider'].includes(row.source)
      || !['pending', 'succeeded', 'failed', 'pending_reconciliation'].includes(row.status)
      || !['full', 'partial'].includes(row.kind)) {
    return err('İade kayıt cevabı geçersiz')
  }
  return ok({
    id: row.id,
    orderId: row.order_id,
    restaurantId: row.restaurant_id,
    method: row.payment_method as OrderRefundResult['method'],
    source: row.source as OrderRefundResult['source'],
    status: row.status as OrderRefundResult['status'],
    kind: row.kind as OrderRefundResult['kind'],
    amount: row.amount,
    idempotencyKey: row.idempotency_key,
    providerPaymentId: typeof row.provider_payment_id === 'string' ? row.provider_payment_id : null,
    providerRefundRef: typeof row.provider_refund_ref === 'string' ? row.provider_refund_ref : null,
    refundedAt: typeof row.refunded_at === 'string' ? row.refunded_at : null,
    replayed: row.replayed === true,
  })
}

function rpc(): Rpc {
  const client = createServiceClient()
  return client.rpc.bind(client) as unknown as Rpc
}

export function createOrderRefundPort(): OrderRefundPort {
  return {
    async recordManual(input) {
      const { data, error } = await rpc()('record_manual_order_refund', {
        p_order_id: input.orderId,
        p_restaurant_id: input.restaurantId,
        p_amount: input.amount,
        p_reason: input.reason,
        p_actor_user_id: input.actorUserId,
        p_idempotency_key: input.idempotencyKey,
      })
      return error ? err(error.message) : normalizeRefund(data)
    },
    async reserveIyzico(input) {
      const { data, error } = await rpc()('reserve_iyzico_order_refund', {
        p_order_id: input.orderId,
        p_restaurant_id: input.restaurantId,
        p_amount: input.amount,
        p_reason: input.reason,
        p_actor_user_id: input.actorUserId,
        p_idempotency_key: input.idempotencyKey,
      })
      return error ? err(error.message) : normalizeRefund(data)
    },
    async finalizeIyzico(input) {
      const { data, error } = await rpc()('finalize_iyzico_order_refund', {
        p_refund_id: input.refundId,
        p_order_id: input.orderId,
        p_restaurant_id: input.restaurantId,
        p_amount: input.amount,
        p_provider_payment_id: input.providerPaymentId,
        p_provider_refund_ref: input.providerRefundRef,
        p_idempotency_key: input.idempotencyKey,
      })
      return error ? err(error.message) : normalizeRefund(data)
    },
    async markIyzicoUnsuccessful(input) {
      const { data, error } = await rpc()('fail_iyzico_order_refund', {
        p_refund_id: input.refundId,
        p_order_id: input.orderId,
        p_restaurant_id: input.restaurantId,
        p_actor_user_id: input.actorUserId,
        p_status: input.status,
        p_failure_code: input.failureCode,
        p_failure_message: input.failureMessage,
      })
      if (error) return err(error.message)
      return data === true ? ok(true) : err('İade durumu kaydedilemedi')
    },
  }
}
