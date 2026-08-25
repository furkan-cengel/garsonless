import type {
  CreateSubscriptionInvoiceResult,
  RecordSubscriptionPaymentFailureResult,
  RecordSubscriptionPaymentSuccessResult,
  SubscriptionBillingPersistencePort,
} from '@garsonless/application/billing'
import {
  isSubscriptionStatus,
  SUBSCRIPTION_INVOICE_STATUSES,
  type SubscriptionInvoiceStatus,
} from '@garsonless/domain/billing'
import { err, ok, type Result } from '@garsonless/domain/result'
import { createServiceClient } from './service-client'

export type SubscriptionBillingRpc = (name: string, args: Record<string, unknown>) => Promise<{
  data: unknown
  error: { message: string } | null
}>

function serviceRpc(): SubscriptionBillingRpc {
  const service = createServiceClient()
  return service.rpc.bind(service) as unknown as SubscriptionBillingRpc
}

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function string(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function nullableString(value: unknown): string | null | undefined {
  return value === null ? null : string(value) ?? undefined
}

function invoiceStatus(value: unknown): SubscriptionInvoiceStatus | null {
  return SUBSCRIPTION_INVOICE_STATUSES.includes(value as SubscriptionInvoiceStatus)
    ? value as SubscriptionInvoiceStatus
    : null
}

function createResult(value: unknown): Result<CreateSubscriptionInvoiceResult> {
  const row = object(value)
  const id = string(row?.invoiceId)
  const status = invoiceStatus(row?.status)
  if (!row || !id || !status || typeof row.duplicate !== 'boolean') return err('Billing invoice RPC result is invalid')
  return ok({ invoiceId: id, status, duplicate: row.duplicate })
}

function failureResult(value: unknown): Result<RecordSubscriptionPaymentFailureResult> {
  const row = object(value)
  const id = string(row?.invoiceId)
  const attemptId = nullableString(row?.attemptId)
  const status = invoiceStatus(row?.invoiceStatus)
  if (!row || !id || attemptId === undefined || (status !== 'past_due' && status !== 'paid')
    || !isSubscriptionStatus(row.subscriptionStatus)
    || typeof row.duplicate !== 'boolean' || typeof row.ignoredBecausePaid !== 'boolean') {
    return err('Billing payment failure RPC result is invalid')
  }
  return ok({
    invoiceId: id,
    attemptId,
    invoiceStatus: status,
    subscriptionStatus: row.subscriptionStatus,
    duplicate: row.duplicate,
    ignoredBecausePaid: row.ignoredBecausePaid,
  })
}

function successResult(value: unknown): Result<RecordSubscriptionPaymentSuccessResult> {
  const row = object(value)
  const id = string(row?.invoiceId)
  const attemptId = nullableString(row?.attemptId)
  const subscriptionStatus = row?.subscriptionStatus
  if (!row || !id || attemptId === undefined || row.invoiceStatus !== 'paid'
    || !['active', 'manual_hold', 'cancelled'].includes(subscriptionStatus as string)
    || typeof row.duplicate !== 'boolean' || typeof row.reactivated !== 'boolean') {
    return err('Billing payment success RPC result is invalid')
  }
  return ok({
    invoiceId: id,
    attemptId,
    invoiceStatus: 'paid',
    subscriptionStatus: subscriptionStatus as 'active' | 'manual_hold' | 'cancelled',
    duplicate: row.duplicate,
    reactivated: row.reactivated,
  })
}

/** Service-role implementation of the SaaS billing persistence boundary. */
export function createSubscriptionBillingPersistencePort(
  rpc: SubscriptionBillingRpc = serviceRpc(),
): SubscriptionBillingPersistencePort {
  return {
    async createInvoice(input) {
      const { data, error } = await rpc('create_subscription_invoice_atomic', {
        p_restaurant_id: input.restaurantId,
        p_subscription_id: input.subscriptionId,
        p_plan: input.plan,
        p_amount_minor: input.amount.minor,
        p_period_start: input.periodStart,
        p_period_end: input.periodEnd,
        p_due_at: input.dueAt,
        p_idempotency_key: input.idempotencyKey,
      })
      return error ? err(error.message) : createResult(data)
    },
    async recordPaymentFailure(input) {
      const { data, error } = await rpc('record_subscription_payment_failure_atomic', {
        p_restaurant_id: input.restaurantId,
        p_subscription_id: input.subscriptionId,
        p_invoice_id: input.invoiceId,
        p_provider_event_id: input.providerEventId,
        p_provider_attempt_ref: input.providerAttemptRef,
        p_amount_minor: input.amount.minor,
        p_failure_code: input.failureCode,
        p_failure_message: input.failureMessage,
        p_occurred_at: input.occurredAt,
        p_idempotency_key: input.idempotencyKey,
      })
      return error ? err(error.message) : failureResult(data)
    },
    async recordPaymentSuccess(input) {
      const { data, error } = await rpc('record_subscription_payment_success_atomic', {
        p_restaurant_id: input.restaurantId,
        p_subscription_id: input.subscriptionId,
        p_invoice_id: input.invoiceId,
        p_provider_event_id: input.providerEventId,
        p_provider_attempt_ref: input.providerAttemptRef,
        p_amount_minor: input.amount.minor,
        p_occurred_at: input.occurredAt,
        p_idempotency_key: input.idempotencyKey,
      })
      return error ? err(error.message) : successResult(data)
    },
  }
}
