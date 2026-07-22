import type { BillingAmount, SubscriptionInvoiceStatus, SubscriptionStatus } from '@garsonless/domain/billing'
import type { PaymentProviderContext, PlatformBillingContext } from '@garsonless/domain/context'
import type { RestaurantPlan } from '@garsonless/domain/entitlements'
import { err, type Result } from '@garsonless/domain/result'

export const BILLING_PROVIDER_EVENT_TYPES = [
  'checkout.completed',
  'invoice.payment_succeeded',
  'invoice.payment_failed',
  'subscription.cancelled',
  'subscription.updated',
  'unknown',
] as const
export type BillingProviderEventType = (typeof BILLING_PROVIDER_EVENT_TYPES)[number]

export type VerifiedSubscriptionBillingEvent = {
  /** Stable provider event id: the database uses this as its replay boundary. */
  eventId: string
  type: BillingProviderEventType
  occurredAt: string
  providerCustomerRef: string | null
  providerSubscriptionRef: string | null
  providerInvoiceRef: string | null
  providerAttemptRef: string | null
  amount: BillingAmount | null
  /** Allowlisted/redacted diagnostic projection — never the raw webhook body. */
  sanitizedPayload: Record<string, unknown>
  payloadHash: string
}

/** Provider-independent SaaS subscription boundary. Tenant order-payment
 * credentials never enter this port; implementations use platform secrets. */
export interface SubscriptionBillingProvider {
  createCustomer(input: {
    restaurantId: string
    legalName: string
    contactEmail: string
    idempotencyKey: string
  }): Promise<Result<{ providerCustomerRef: string }>>

  createCheckout(input: {
    providerCustomerRef: string
    invoiceId: string
    plan: RestaurantPlan
    amount: BillingAmount
    callbackUrl: string
    returnUrl: string
    idempotencyKey: string
  }): Promise<Result<{
    providerCheckoutRef: string
    checkoutUrl: string
    expiresAt: string | null
  }>>

  verifyWebhook(input: {
    rawBody: Uint8Array
    headers: Readonly<Record<string, string | undefined>>
  }): Promise<Result<VerifiedSubscriptionBillingEvent>>

  retryInvoice(input: {
    providerCustomerRef: string
    providerInvoiceRef: string | null
    invoiceId: string
    amount: BillingAmount
    idempotencyKey: string
  }): Promise<Result<{
    providerAttemptRef: string
    status: 'pending' | 'requires_action' | 'succeeded' | 'failed'
  }>>

  cancelSubscription(input: {
    providerSubscriptionRef: string
    atPeriodEnd: boolean
    idempotencyKey: string
  }): Promise<Result<{ cancelledAt: string | null }>>
}

/** Keeps signature verification and event normalization behind the provider
 * adapter while rejecting structurally unusable events before persistence. */
export async function verifySubscriptionBillingWebhook(
  input: { rawBody: Uint8Array; headers: Readonly<Record<string, string | undefined>> },
  provider: SubscriptionBillingProvider,
): Promise<Result<VerifiedSubscriptionBillingEvent>> {
  if (input.rawBody.byteLength === 0) return err('Webhook body is required')
  const verified = await provider.verifyWebhook(input)
  if (!verified.ok) return verified
  if (!verified.value.eventId.trim()) return err('Provider event id is required')
  if (!Number.isFinite(Date.parse(verified.value.occurredAt))) return err('Provider event timestamp is invalid')
  if (!verified.value.payloadHash.trim()) return err('Provider payload hash is required')
  return verified
}

export type CreateSubscriptionInvoiceInput = {
  restaurantId: string
  subscriptionId: string
  plan: Exclude<RestaurantPlan, 'free'>
  amount: BillingAmount
  periodStart: string
  periodEnd: string
  dueAt: string
  idempotencyKey: string
}

export type RecordSubscriptionPaymentFailureInput = {
  restaurantId: string
  subscriptionId: string
  invoiceId: string
  providerEventId: string
  providerAttemptRef: string | null
  amount: BillingAmount
  failureCode: string | null
  failureMessage: string | null
  occurredAt: string
  idempotencyKey: string
}

export type RecordSubscriptionPaymentSuccessInput = {
  restaurantId: string
  subscriptionId: string
  invoiceId: string
  providerEventId: string
  providerAttemptRef: string | null
  amount: BillingAmount
  occurredAt: string
  idempotencyKey: string
}

export type CreateSubscriptionInvoiceResult = {
  invoiceId: string
  status: SubscriptionInvoiceStatus
  duplicate: boolean
}

export type RecordSubscriptionPaymentFailureResult = {
  invoiceId: string
  attemptId: string | null
  invoiceStatus: 'past_due' | 'paid'
  subscriptionStatus: SubscriptionStatus
  duplicate: boolean
  ignoredBecausePaid: boolean
}

export type RecordSubscriptionPaymentSuccessResult = {
  invoiceId: string
  attemptId: string | null
  invoiceStatus: 'paid'
  subscriptionStatus: 'active' | 'manual_hold' | 'cancelled'
  duplicate: boolean
  reactivated: boolean
}

/** The application layer owns billing input/context validation while the DB
 * implementation owns the transaction, locks and outbox atomicity. */
export interface SubscriptionBillingPersistencePort {
  createInvoice(input: CreateSubscriptionInvoiceInput): Promise<Result<CreateSubscriptionInvoiceResult>>
  recordPaymentFailure(input: RecordSubscriptionPaymentFailureInput): Promise<Result<RecordSubscriptionPaymentFailureResult>>
  recordPaymentSuccess(input: RecordSubscriptionPaymentSuccessInput): Promise<Result<RecordSubscriptionPaymentSuccessResult>>
}

function validId(value: string): boolean {
  return value.trim().length > 0
}

function validTimestamp(value: string): boolean {
  return value.trim().length > 0 && Number.isFinite(Date.parse(value))
}

function validateCommon(input: {
  restaurantId: string
  subscriptionId: string
  amount: BillingAmount
  idempotencyKey: string
}): Result<true> {
  if (!validId(input.restaurantId)) return err('Restaurant id is required')
  if (!validId(input.subscriptionId)) return err('Subscription id is required')
  if (!Number.isSafeInteger(input.amount.minor) || input.amount.minor < 0 || input.amount.currency !== 'TRY') {
    return err('Billing amount is invalid')
  }
  if (!validId(input.idempotencyKey) || input.idempotencyKey.trim().length > 160) {
    return err('Billing idempotency key is invalid')
  }
  return { ok: true, value: true }
}

export async function createSubscriptionInvoice(
  context: PlatformBillingContext,
  input: CreateSubscriptionInvoiceInput,
  port: SubscriptionBillingPersistencePort,
): Promise<Result<CreateSubscriptionInvoiceResult>> {
  if (context.restaurantId !== input.restaurantId || context.provider !== 'iyzico') return err('Billing context mismatch')
  const common = validateCommon(input)
  if (!common.ok) return common
  if (!['starter', 'pro', 'enterprise'].includes(input.plan)) return err('Paid billing plan is required')
  if (!validTimestamp(input.periodStart) || !validTimestamp(input.periodEnd) || !validTimestamp(input.dueAt)) {
    return err('Invoice timestamps are invalid')
  }
  if (Date.parse(input.periodEnd) <= Date.parse(input.periodStart)) return err('Invoice period is invalid')
  return port.createInvoice(input)
}

export async function recordSubscriptionPaymentFailure(
  context: PaymentProviderContext,
  input: RecordSubscriptionPaymentFailureInput,
  port: SubscriptionBillingPersistencePort,
): Promise<Result<RecordSubscriptionPaymentFailureResult>> {
  if (context.restaurantId !== input.restaurantId || context.provider !== 'iyzico') return err('Billing context mismatch')
  const common = validateCommon(input)
  if (!common.ok) return common
  if (!validId(input.invoiceId) || !validId(input.providerEventId)) return err('Invoice and provider event ids are required')
  if (!validTimestamp(input.occurredAt)) return err('Payment timestamp is invalid')
  if (input.failureCode && input.failureCode.length > 100) return err('Failure code is invalid')
  if (input.failureMessage && input.failureMessage.length > 500) return err('Failure message is invalid')
  return port.recordPaymentFailure(input)
}

export async function recordSubscriptionPaymentSuccess(
  context: PaymentProviderContext,
  input: RecordSubscriptionPaymentSuccessInput,
  port: SubscriptionBillingPersistencePort,
): Promise<Result<RecordSubscriptionPaymentSuccessResult>> {
  if (context.restaurantId !== input.restaurantId || context.provider !== 'iyzico') return err('Billing context mismatch')
  const common = validateCommon(input)
  if (!common.ok) return common
  if (!validId(input.invoiceId) || !validId(input.providerEventId)) return err('Invoice and provider event ids are required')
  if (!validTimestamp(input.occurredAt)) return err('Payment timestamp is invalid')
  return port.recordPaymentSuccess(input)
}
