import type {
  BillingCurrency,
  SubscriptionInvoiceStatus,
  SubscriptionPaymentAttemptStatus,
} from '@garsonless/domain/billing'
import {
  BILLING_CURRENCY,
  SUBSCRIPTION_INVOICE_STATUSES,
  SUBSCRIPTION_PAYMENT_ATTEMPT_STATUSES,
} from '@garsonless/domain/billing'
import {
  platformAdminCan,
  type PlatformAdminActorContext,
} from '@garsonless/domain/platform-admin'
import { err, type Result } from '@garsonless/domain/result'

export const PLATFORM_BILLING_TIMELINE_KINDS = [
  'invoice',
  'payment_attempt',
  'dunning',
  'reconciliation',
  'provider_event',
  'provider_operation',
] as const
export type PlatformBillingTimelineKind = typeof PLATFORM_BILLING_TIMELINE_KINDS[number]

export const PLATFORM_DUNNING_STATUSES = ['scheduled', 'running', 'completed', 'stopped', 'failed'] as const
export const PLATFORM_DUNNING_STEPS = ['pre_due', 'due', 'retry', 'warning_3', 'warning_7', 'suspend'] as const
export const PLATFORM_RECONCILIATION_STATUSES = ['pending', 'running', 'resolved', 'discrepancy', 'failed'] as const
export const PLATFORM_RECONCILIATION_SCOPES = ['subscription', 'invoice', 'provider_event', 'tenant'] as const
export const PLATFORM_PROVIDER_EVENT_STATUSES = ['received', 'processing', 'processed', 'failed', 'dead_lettered'] as const
export const PLATFORM_PROVIDER_EVENT_TYPES = [
  'checkout.completed',
  'invoice.payment_succeeded',
  'invoice.payment_failed',
  'subscription.cancelled',
  'subscription.updated',
  'unknown',
] as const
export const PLATFORM_PROVIDER_OPERATION_STATUSES = [
  'processing',
  'awaiting_callback',
  'succeeded',
  'requires_reconciliation',
] as const
export const PLATFORM_PROVIDER_OPERATION_TYPES = [
  'checkout.initialize',
  'payment.retry',
  'subscription.cancel',
] as const

export type PlatformBillingTimelineItem = {
  id: string
  kind: PlatformBillingTimelineKind
  status: string
  action: string
  occurredAt: string
  invoiceId: string | null
  amountMinor: number | null
  currency: BillingCurrency | null
  attempt: number | null
  nextActionAt: string | null
  completedAt: string | null
  hasError: boolean
}

export type PlatformTenantBillingTimeline = {
  summary: {
    outstandingMinor: number
    currency: BillingCurrency
    openInvoices: number
    activeDunning: number
    openReconciliation: number
    failedAttempts: number
  }
  items: PlatformBillingTimelineItem[]
}

export interface PlatformTenantBillingReadPort {
  readTimeline(input: {
    restaurantId: string
    actorUserId: string
    actorRole: PlatformAdminActorContext['role']
    limit: number
  }): Promise<Result<PlatformTenantBillingTimeline>>
}

export type PlatformTenantBillingReadError =
  | 'Not authorized'
  | 'Invalid tenant id'
  | 'Invalid timeline limit'
  | 'Billing timeline could not be loaded'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function readPlatformTenantBillingTimeline(
  actor: PlatformAdminActorContext,
  restaurantId: string,
  port: PlatformTenantBillingReadPort,
  limit = 50,
): Promise<Result<PlatformTenantBillingTimeline, PlatformTenantBillingReadError>> {
  if (!platformAdminCan(actor, 'billing.manage')) return err('Not authorized')
  if (!UUID.test(restaurantId)) return err('Invalid tenant id')
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) return err('Invalid timeline limit')
  const result = await port.readTimeline({
    restaurantId,
    actorUserId: actor.userId,
    actorRole: actor.role,
    limit,
  })
  return result.ok ? result : err('Billing timeline could not be loaded')
}

export function isPlatformBillingTimelineKind(value: unknown): value is PlatformBillingTimelineKind {
  return PLATFORM_BILLING_TIMELINE_KINDS.includes(value as PlatformBillingTimelineKind)
}

export function isPlatformBillingTimelineStatus(kind: PlatformBillingTimelineKind, value: unknown): boolean {
  switch (kind) {
    case 'invoice': return SUBSCRIPTION_INVOICE_STATUSES.includes(value as SubscriptionInvoiceStatus)
    case 'payment_attempt': return SUBSCRIPTION_PAYMENT_ATTEMPT_STATUSES.includes(value as SubscriptionPaymentAttemptStatus)
    case 'dunning': return PLATFORM_DUNNING_STATUSES.includes(value as typeof PLATFORM_DUNNING_STATUSES[number])
    case 'reconciliation': return PLATFORM_RECONCILIATION_STATUSES.includes(value as typeof PLATFORM_RECONCILIATION_STATUSES[number])
    case 'provider_event': return PLATFORM_PROVIDER_EVENT_STATUSES.includes(value as typeof PLATFORM_PROVIDER_EVENT_STATUSES[number])
    case 'provider_operation': return PLATFORM_PROVIDER_OPERATION_STATUSES.includes(value as typeof PLATFORM_PROVIDER_OPERATION_STATUSES[number])
  }
}

export function isPlatformBillingTimelineAction(kind: PlatformBillingTimelineKind, value: unknown): boolean {
  switch (kind) {
    case 'invoice': return value === 'invoice'
    case 'payment_attempt': return value === 'payment.attempt'
    case 'dunning': return PLATFORM_DUNNING_STEPS.includes(value as typeof PLATFORM_DUNNING_STEPS[number])
    case 'reconciliation': return PLATFORM_RECONCILIATION_SCOPES.includes(value as typeof PLATFORM_RECONCILIATION_SCOPES[number])
    case 'provider_event': return PLATFORM_PROVIDER_EVENT_TYPES.includes(value as typeof PLATFORM_PROVIDER_EVENT_TYPES[number])
    case 'provider_operation': return PLATFORM_PROVIDER_OPERATION_TYPES.includes(value as typeof PLATFORM_PROVIDER_OPERATION_TYPES[number])
  }
}

export function isPlatformBillingCurrency(value: unknown): value is BillingCurrency {
  return value === BILLING_CURRENCY
}
