import type { RestaurantPlan } from './entitlements'

/** ADR-0003 subscription lifecycle. These values are persisted, so additions
 * require an explicit migration and transition-policy review. */
export const SUBSCRIPTION_STATUSES = [
  'trial',
  'trial_expired',
  'active',
  'past_due',
  'grace_period',
  'suspended',
  'refund_cancel_pending',
  'cancelled',
  'manual_hold',
] as const
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number]

export const SUBSCRIPTION_INVOICE_STATUSES = [
  'draft',
  'open',
  'paid',
  'past_due',
  'void',
  'uncollectible',
] as const
export type SubscriptionInvoiceStatus = (typeof SUBSCRIPTION_INVOICE_STATUSES)[number]

export const SUBSCRIPTION_PAYMENT_ATTEMPT_STATUSES = [
  'pending',
  'requires_action',
  'succeeded',
  'failed',
  'cancelled',
] as const
export type SubscriptionPaymentAttemptStatus = (typeof SUBSCRIPTION_PAYMENT_ATTEMPT_STATUSES)[number]

export const BILLING_CURRENCY = 'TRY' as const
export type BillingCurrency = typeof BILLING_CURRENCY

export type BillingAmount = {
  /** Integer minor units. TRY 149.90 is stored as 14990 — never a float. */
  minor: number
  currency: BillingCurrency
}

export type BillingDunningPolicy = {
  trialDays: number
  preDueReminderDays: number
  retryAfterDays: number
  secondWarningAfterDays: number
  finalWarningAfterDays: number
  suspendAfterDays: number
  cancelledRetentionDays: number
}

export type BillingSubscriptionSnapshot = {
  id: string
  restaurantId: string
  plan: RestaurantPlan
  scheduledPlan: RestaurantPlan | null
  status: SubscriptionStatus
  periodStart: string | null
  periodEnd: string | null
  trialEndsAt: string | null
}

/** Fail-closed lifecycle edges. Provider callbacks and admin actions both use
 * the same matrix; actor-specific authorization remains in the adapter. */
export const SUBSCRIPTION_STATUS_TRANSITIONS: Readonly<Record<SubscriptionStatus, readonly SubscriptionStatus[]>> = {
  trial: ['active', 'trial_expired', 'cancelled', 'manual_hold'],
  trial_expired: ['active', 'cancelled', 'manual_hold'],
  active: ['past_due', 'refund_cancel_pending', 'cancelled', 'manual_hold'],
  past_due: ['active', 'grace_period', 'refund_cancel_pending', 'cancelled', 'manual_hold'],
  grace_period: ['active', 'suspended', 'refund_cancel_pending', 'cancelled', 'manual_hold'],
  suspended: ['active', 'refund_cancel_pending', 'cancelled', 'manual_hold'],
  refund_cancel_pending: ['cancelled'],
  cancelled: [],
  manual_hold: ['active', 'past_due', 'grace_period', 'suspended', 'refund_cancel_pending', 'cancelled'],
}

export function canTransitionSubscriptionStatus(from: SubscriptionStatus, to: SubscriptionStatus): boolean {
  return from === to || SUBSCRIPTION_STATUS_TRANSITIONS[from].includes(to)
}

export function isSubscriptionStatus(value: unknown): value is SubscriptionStatus {
  return SUBSCRIPTION_STATUSES.includes(value as SubscriptionStatus)
}

export function parseBillingAmount(minor: unknown, currency: unknown): BillingAmount | null {
  if (currency !== BILLING_CURRENCY || !Number.isSafeInteger(minor) || (minor as number) < 0) return null
  return { minor: minor as number, currency: BILLING_CURRENCY }
}

/** Policy values live in the database, not in a code constant. This validator
 * accepts a loaded snapshot only when its ordering preserves ADR-0002. */
export function isValidBillingDunningPolicy(policy: BillingDunningPolicy): boolean {
  const values = Object.values(policy)
  return values.every((value) => Number.isInteger(value) && value > 0)
    && policy.retryAfterDays < policy.secondWarningAfterDays
    && policy.secondWarningAfterDays < policy.finalWarningAfterDays
    && policy.finalWarningAfterDays < policy.suspendAfterDays
}
