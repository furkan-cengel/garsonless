import type {
  PlatformSubscriptionRefund,
  PlatformSubscriptionRefundPort,
  PlatformSubscriptionRefundPreparation,
  SubscriptionRefundAccessAction,
  SubscriptionRefundKind,
  SubscriptionRefundStatus,
} from '@garsonless/application/platform-admin-subscription-refunds'
import { err, ok, type Result } from '@garsonless/domain/result'
import { createServiceClient } from './service-client'

type Rpc = (name: string, args: Record<string, unknown>) => Promise<{
  data: unknown
  error: { message: string } | null
}>

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const KINDS = ['same_day_cancel', 'refund'] as const
const ACCESS_ACTIONS = ['keep', 'cancel_immediately'] as const
const STATUSES = ['requested', 'processing', 'succeeded', 'failed', 'requires_reconciliation'] as const
const CANCELLATION_STATUSES = [
  'scheduled', 'processing', 'provider_cancelled', 'applied', 'requires_reconciliation',
] as const

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null
}

function parseRefund(value: unknown): Result<PlatformSubscriptionRefund> {
  const row = object(value)
  if (!row || !UUID.test(String(row.refundId)) || !UUID.test(String(row.operationId))
    || !UUID.test(String(row.restaurantId)) || !UUID.test(String(row.subscriptionId))
    || !UUID.test(String(row.invoiceId)) || !KINDS.includes(row.kind as SubscriptionRefundKind)
    || !['full', 'partial'].includes(String(row.scope))
    || !ACCESS_ACTIONS.includes(row.accessAction as SubscriptionRefundAccessAction)
    || !Number.isSafeInteger(row.amountMinor) || (row.amountMinor as number) <= 0
    || row.currency !== 'TRY' || !STATUSES.includes(row.status as SubscriptionRefundStatus)
    || (row.providerRefundRef !== null && typeof row.providerRefundRef !== 'string')
    || (row.cancellationRequestId !== null && !UUID.test(String(row.cancellationRequestId)))
    || (row.cancellationStatus !== null && !CANCELLATION_STATUSES.includes(row.cancellationStatus as typeof CANCELLATION_STATUSES[number]))
    || typeof row.dispatchable !== 'boolean' || typeof row.duplicate !== 'boolean') {
    return err('Subscription refund result is invalid')
  }
  return ok({
    refundId: String(row.refundId), operationId: String(row.operationId),
    restaurantId: String(row.restaurantId), subscriptionId: String(row.subscriptionId),
    invoiceId: String(row.invoiceId), kind: row.kind as SubscriptionRefundKind,
    scope: row.scope as 'full' | 'partial', accessAction: row.accessAction as SubscriptionRefundAccessAction,
    amountMinor: row.amountMinor as number,
    currency: 'TRY', status: row.status as SubscriptionRefundStatus,
    providerRefundRef: row.providerRefundRef as string | null,
    cancellationRequestId: row.cancellationRequestId as string | null,
    cancellationStatus: row.cancellationStatus as PlatformSubscriptionRefund['cancellationStatus'],
    dispatchable: row.dispatchable, duplicate: row.duplicate,
  })
}

function parsePreparation(value: unknown): Result<PlatformSubscriptionRefundPreparation> {
  const parsed = parseRefund({ ...object(value), providerRefundRef: object(value)?.providerRefundRef ?? null })
  const providerPaymentId = object(value)?.providerPaymentId
  return parsed.ok && typeof providerPaymentId === 'string' && providerPaymentId.length > 0
    ? ok({ ...parsed.value, providerPaymentId })
    : parsed.ok ? err('Subscription refund payment identity is invalid') : parsed
}

function serviceRpc(): Rpc {
  const client = createServiceClient()
  return client.rpc.bind(client) as unknown as Rpc
}

export function createPlatformSubscriptionRefundPort(rpc: Rpc = serviceRpc()): PlatformSubscriptionRefundPort {
  const call = async (name: string, args: Record<string, unknown>) => {
    const { data, error } = await rpc(name, args)
    return error ? err(error.message) : ok(data)
  }
  return {
    async prepare(input) {
      const result = await call('prepare_platform_subscription_refund', {
        p_restaurant_id: input.restaurantId, p_invoice_id: input.invoiceId,
        p_actor_user_id: input.actorUserId, p_actor_role: input.actorRole,
        p_kind: input.kind, p_access_action: input.accessAction, p_amount_minor: input.amountMinor,
        p_reason_code: input.reasonCode, p_reason_detail: input.reasonDetail,
        p_request_id: input.requestId, p_idempotency_key: input.idempotencyKey,
        p_request_fingerprint: input.requestFingerprint, p_occurred_at: input.occurredAt,
      })
      return result.ok ? parsePreparation(result.value) : result
    },
    async complete(input) {
      const result = await call('complete_platform_subscription_refund', {
        p_refund_id: input.refundId, p_operation_id: input.operationId,
        p_provider_payment_id: input.providerPaymentId,
        p_provider_refund_ref: input.providerRefundRef,
        p_amount_minor: input.amountMinor, p_occurred_at: input.occurredAt,
      })
      return result.ok ? parseRefund(result.value) : result
    },
    async fail(input) {
      const result = await call('fail_platform_subscription_refund', {
        p_refund_id: input.refundId, p_operation_id: input.operationId,
        p_failure_code: input.failureCode,
        p_requires_reconciliation: input.requiresReconciliation,
        p_occurred_at: input.occurredAt,
      })
      return result.ok ? parseRefund(result.value) : result
    },
  }
}
