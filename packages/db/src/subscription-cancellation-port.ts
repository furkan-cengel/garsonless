import type { SubscriptionCancellationSchedulePort } from '@garsonless/application/billing'
import { err, ok, type Result } from '@garsonless/domain/result'
import { createServiceClient } from './service-client'

export type SubscriptionCancellationRpc = (
  name: 'schedule_subscription_cancellation' | 'withdraw_subscription_cancellation',
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message: string } | null }>

function serviceRpc(): SubscriptionCancellationRpc {
  const service = createServiceClient()
  return service.rpc.bind(service) as unknown as SubscriptionCancellationRpc
}

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function timestamp(value: unknown): string | null {
  const parsed = text(value)
  return parsed && Number.isFinite(Date.parse(parsed)) ? parsed : null
}

type CancellationScheduleResult = {
  cancellationRequestId: string
  subscriptionId: string
  status: 'scheduled' | 'processing' | 'provider_cancelled' | 'applied' | 'withdrawn' | 'requires_reconciliation'
  effectiveAt: string
  duplicate: boolean
}

type CancellationWithdrawalResult = {
  cancellationRequestId: string
  subscriptionId: string
  status: 'withdrawn'
  duplicate: boolean
}

function scheduleResult(value: unknown): Result<CancellationScheduleResult> {
  const row = object(value)
  const cancellationRequestId = text(row?.cancellationRequestId)
  const subscriptionId = text(row?.subscriptionId)
  const effectiveAt = timestamp(row?.effectiveAt)
  const status = row?.status
  if (!row || !cancellationRequestId || !subscriptionId || !effectiveAt
    || !['scheduled', 'processing', 'provider_cancelled', 'applied', 'withdrawn', 'requires_reconciliation'].includes(status as string)
    || typeof row.duplicate !== 'boolean') {
    return err('Billing cancellation schedule result is invalid')
  }
  return ok({
    cancellationRequestId,
    subscriptionId,
    status: status as 'scheduled' | 'processing' | 'provider_cancelled' | 'applied' | 'withdrawn' | 'requires_reconciliation',
    effectiveAt,
    duplicate: row.duplicate,
  })
}

function withdrawalResult(value: unknown): Result<CancellationWithdrawalResult> {
  const row = object(value)
  const cancellationRequestId = text(row?.cancellationRequestId)
  const subscriptionId = text(row?.subscriptionId)
  if (!row || !cancellationRequestId || !subscriptionId || row.status !== 'withdrawn'
    || typeof row.duplicate !== 'boolean') {
    return err('Billing cancellation withdrawal result is invalid')
  }
  return ok({
    cancellationRequestId,
    subscriptionId,
    status: 'withdrawn',
    duplicate: row.duplicate,
  })
}

export function createSubscriptionCancellationSchedulePort(
  rpc: SubscriptionCancellationRpc = serviceRpc(),
): SubscriptionCancellationSchedulePort {
  return {
    async scheduleCancellation(input) {
      const { data, error } = await rpc('schedule_subscription_cancellation', {
        p_restaurant_id: input.restaurantId,
        p_idempotency_key: input.idempotencyKey,
        p_request_fingerprint: input.requestFingerprint,
        p_requested_by: input.requestedBy,
        p_occurred_at: input.occurredAt,
      })
      return error ? err('Billing cancellation could not be scheduled') : scheduleResult(data)
    },

    async withdrawCancellation(input) {
      const { data, error } = await rpc('withdraw_subscription_cancellation', {
        p_restaurant_id: input.restaurantId,
        p_cancellation_request_id: input.cancellationRequestId,
        p_idempotency_key: input.idempotencyKey,
        p_request_fingerprint: input.requestFingerprint,
        p_withdrawn_by: input.withdrawnBy,
        p_occurred_at: input.occurredAt,
      })
      return error ? err('Billing cancellation could not be withdrawn') : withdrawalResult(data)
    },
  }
}
