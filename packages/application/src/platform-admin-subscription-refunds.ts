import { platformAdminCan, type PlatformAdminActorContext } from '@garsonless/domain/platform-admin'
import { err, ok, type Result } from '@garsonless/domain/result'

export const SUBSCRIPTION_REFUND_KINDS = ['same_day_cancel', 'refund'] as const
export type SubscriptionRefundKind = (typeof SUBSCRIPTION_REFUND_KINDS)[number]
export const SUBSCRIPTION_REFUND_ACCESS_ACTIONS = ['keep', 'cancel_immediately'] as const
export type SubscriptionRefundAccessAction = (typeof SUBSCRIPTION_REFUND_ACCESS_ACTIONS)[number]
export const SUBSCRIPTION_REFUND_REASON_CODES = [
  'customer_request', 'billing_error', 'duplicate_charge', 'service_issue', 'legal', 'other',
] as const
export type SubscriptionRefundReasonCode = (typeof SUBSCRIPTION_REFUND_REASON_CODES)[number]
export type SubscriptionRefundStatus = 'requested' | 'processing' | 'succeeded' | 'failed' | 'requires_reconciliation'

export type PlatformSubscriptionRefund = {
  refundId: string
  operationId: string
  restaurantId: string
  subscriptionId: string
  invoiceId: string
  kind: SubscriptionRefundKind
  scope: 'full' | 'partial'
  accessAction: SubscriptionRefundAccessAction
  amountMinor: number
  currency: 'TRY'
  status: SubscriptionRefundStatus
  providerRefundRef: string | null
  cancellationRequestId: string | null
  cancellationStatus: 'scheduled' | 'processing' | 'provider_cancelled' | 'applied' | 'requires_reconciliation' | null
  dispatchable: boolean
  duplicate: boolean
}

export type PlatformSubscriptionRefundPreparation = PlatformSubscriptionRefund & {
  providerPaymentId: string
}

export interface PlatformSubscriptionRefundPort {
  prepare(input: {
    restaurantId: string
    invoiceId: string
    actorUserId: string
    actorRole: PlatformAdminActorContext['role']
    kind: SubscriptionRefundKind
    accessAction: SubscriptionRefundAccessAction
    amountMinor: number
    reasonCode: SubscriptionRefundReasonCode
    reasonDetail: string
    requestId: string
    idempotencyKey: string
    requestFingerprint: string
    occurredAt: string
  }): Promise<Result<PlatformSubscriptionRefundPreparation>>
  complete(input: {
    refundId: string
    operationId: string
    providerPaymentId: string
    providerRefundRef: string
    amountMinor: number
    occurredAt: string
  }): Promise<Result<PlatformSubscriptionRefund>>
  fail(input: {
    refundId: string
    operationId: string
    failureCode: string
    requiresReconciliation: boolean
    occurredAt: string
  }): Promise<Result<PlatformSubscriptionRefund>>
}

export type SubscriptionRefundProviderOutcome =
  | { outcome: 'succeeded'; providerPaymentId: string; providerRefundRef: string; amountMinor: number }
  | { outcome: 'rejected'; code: string }
  | { outcome: 'uncertain'; code: string }

export interface SubscriptionRefundProvider {
  execute(input: {
    refundId: string
    kind: SubscriptionRefundKind
    accessAction: SubscriptionRefundAccessAction
    providerPaymentId: string
    amountMinor: number
  }): Promise<SubscriptionRefundProviderOutcome>
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const FINGERPRINT = /^[a-f0-9]{64}$/

export async function requestPlatformSubscriptionRefund(
  actor: PlatformAdminActorContext,
  input: {
    restaurantId: string
    invoiceId: string
    kind: SubscriptionRefundKind
    accessAction: SubscriptionRefundAccessAction
    amountMinor: number
    reasonCode: SubscriptionRefundReasonCode
    reasonDetail: string
    requestId: string
    idempotencyKey: string
    requestFingerprint: string
    occurredAt?: string
  },
  port: PlatformSubscriptionRefundPort,
  provider: SubscriptionRefundProvider,
): Promise<Result<PlatformSubscriptionRefund>> {
  if (!platformAdminCan(actor, 'billing.manage')) return err('Not authorized')
  const occurredAt = input.occurredAt ?? new Date().toISOString()
  const accessAction: SubscriptionRefundAccessAction = input.kind === 'same_day_cancel'
    ? 'cancel_immediately'
    : input.accessAction
  if (!UUID.test(input.restaurantId) || !UUID.test(input.invoiceId) || !UUID.test(input.requestId)
    || !SUBSCRIPTION_REFUND_KINDS.includes(input.kind)
    || !SUBSCRIPTION_REFUND_ACCESS_ACTIONS.includes(accessAction)
    || !SUBSCRIPTION_REFUND_REASON_CODES.includes(input.reasonCode)
    || !Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0
    || input.reasonDetail.trim().length < 10 || input.reasonDetail.trim().length > 1000
    || input.idempotencyKey.trim().length < 1 || input.idempotencyKey.trim().length > 160
    || !FINGERPRINT.test(input.requestFingerprint)
    || !Number.isFinite(Date.parse(occurredAt))) return err('Invalid subscription refund input')

  const prepared = await port.prepare({
    ...input,
    accessAction,
    actorUserId: actor.userId,
    actorRole: actor.role,
    reasonDetail: input.reasonDetail.trim(),
    idempotencyKey: input.idempotencyKey.trim(),
    occurredAt,
  })
  if (!prepared.ok) return prepared
  if (!prepared.value.dispatchable) {
    const { providerPaymentId: _providerPaymentId, ...safe } = prepared.value
    return ok(safe)
  }

  let outcome: SubscriptionRefundProviderOutcome
  try {
    outcome = await provider.execute({
      refundId: prepared.value.refundId,
      kind: prepared.value.kind,
      accessAction: prepared.value.accessAction,
      providerPaymentId: prepared.value.providerPaymentId,
      amountMinor: prepared.value.amountMinor,
    })
  } catch {
    outcome = { outcome: 'uncertain', code: 'provider_call_threw' }
  }

  if (outcome.outcome === 'succeeded') {
    const completed = await port.complete({
      refundId: prepared.value.refundId,
      operationId: prepared.value.operationId,
      providerPaymentId: outcome.providerPaymentId,
      providerRefundRef: outcome.providerRefundRef,
      amountMinor: outcome.amountMinor,
      occurredAt,
    })
    if (completed.ok) return completed
    const reconciled = await port.fail({
      refundId: prepared.value.refundId,
      operationId: prepared.value.operationId,
      failureCode: 'local_completion_failed_after_provider_success',
      requiresReconciliation: true,
      occurredAt,
    })
    return reconciled.ok ? reconciled : err('Refund succeeded at provider but reconciliation could not be recorded')
  }

  return port.fail({
    refundId: prepared.value.refundId,
    operationId: prepared.value.operationId,
    failureCode: outcome.code.slice(0, 100),
    requiresReconciliation: outcome.outcome === 'uncertain',
    occurredAt,
  })
}
