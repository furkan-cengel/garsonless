import type { BillingAmount, SubscriptionInvoiceStatus, SubscriptionStatus } from '@garsonless/domain/billing'
import type { DashboardActorContext, PaymentProviderContext, PlatformBillingContext } from '@garsonless/domain/context'
import type {
  BillingInterval,
  RestaurantAddOn,
  RestaurantPlan,
  SelfServePlan,
} from '@garsonless/domain/entitlements'
import { isValidAddOnSelection } from '@garsonless/domain/entitlements'
import { err, ok, type Result } from '@garsonless/domain/result'

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

export type SubscriptionBillingAddress = {
  contactName: string
  city: string
  district: string | null
  country: string
  address: string
  zipCode: string | null
}

/** Provider-neutral subscriber identity required by hosted subscription
 * checkout. The application never accepts card details; those remain inside
 * the provider-hosted form. */
export type SubscriptionBillingCustomer = {
  name: string
  surname: string
  identityNumber: string
  email: string
  gsmNumber: string
  billingAddress: SubscriptionBillingAddress
  shippingAddress: SubscriptionBillingAddress
}

/** Provider-independent SaaS subscription boundary. Tenant order-payment
 * credentials never enter this port; implementations use platform secrets. */
export interface SubscriptionBillingProvider {
  createCustomer(input: {
    restaurantId: string
    customer: SubscriptionBillingCustomer
    idempotencyKey: string
  }): Promise<Result<{ providerCustomerRef: string }>>

  createCheckout(input: {
    /** İyzico hosted checkout creates/links the subscriber as part of the
     * checkout request and therefore requires the customer profile again. */
    customer: SubscriptionBillingCustomer
    invoiceId: string
    plan: SelfServePlan
    addOns?: readonly RestaurantAddOn[]
    interval: BillingInterval
    amount: BillingAmount
    callbackUrl: string
    idempotencyKey: string
  }): Promise<Result<{
    providerCheckoutRef: string
    /** Exact provider plan reference used to initialize the hosted form. It is
     * persisted with the operation so config changes cannot rebind callbacks. */
    providerPlanRef: string
    checkoutContent: string
    expiresAt: string | null
  }>>

  retrieveCheckout(input: {
    providerCheckoutRef: string
    idempotencyKey: string
    /** Exact provider reference durably captured during hosted initialization. */
    expectedProviderPlanRef: string
    expectedAmount: BillingAmount
    expectedBillingInterval: BillingInterval
  }): Promise<Result<BillingCheckoutActiveResult>>

  probeCheckout(input: {
    providerCheckoutRef: string
    idempotencyKey: string
    expectedProviderPlanRef: string
    expectedAmount: BillingAmount
    expectedBillingInterval: BillingInterval
  }): Promise<Result<BillingCheckoutProbeResult>>

  verifyWebhook(input: {
    rawBody: Uint8Array
    headers: Readonly<Record<string, string | undefined>>
  }): Promise<Result<VerifiedSubscriptionBillingEvent>>

  retryInvoice(input: {
    /** Failed orderReferenceCode received in the verified webhook. */
    providerPaymentRef: string
    invoiceId: string
    idempotencyKey: string
  }): Promise<Result<{
    /** The definitive attempt reference/status arrives asynchronously by
     * webhook; a successful retry request only means the provider accepted it. */
    accepted: true
  }>>

  cancelSubscription(input: {
    providerSubscriptionRef: string
    idempotencyKey: string
  }): Promise<Result<{ cancelledAt: string | null }>>

  /** Read-only provider lookup used to reconcile an ambiguous cancellation.
   * It must never mutate, retry or infer a successful cancellation. */
  probeSubscriptionStatus?(input: {
    providerSubscriptionRef: string
    idempotencyKey: string
  }): Promise<Result<{
    status: 'active' | 'pending' | 'unpaid' | 'cancelled' | 'expired' | 'upgraded'
    observedAt: string
  }>>
}

export type SubscriptionBillingProfile = SubscriptionBillingCustomer & {
  legalName: string
  taxOffice: string
}

export type SubscriptionBillingSettingsSubscription = {
  id: string
  plan: RestaurantPlan
  billingInterval: BillingInterval
  scheduledPlan: RestaurantPlan | null
  status: SubscriptionStatus
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  trialEndsAt: string | null
  graceEndsAt: string | null
  cancelledAt: string | null
  activeAddOns: RestaurantAddOn[]
  scheduledAddOns: RestaurantAddOn[]
  cancelAtPeriodEnd: boolean
  cancellationRequestId: string | null
  cancellationEffectiveAt: string | null
  cancellationStatus: 'scheduled' | 'processing' | 'provider_cancelled' | 'requires_reconciliation' | null
}

export type SubscriptionBillingSettingsInvoice = {
  id: string
  plan: SelfServePlan
  addOns: RestaurantAddOn[]
  billingInterval: BillingInterval
  amountDueMinor: number
  amountPaidMinor: number
  currency: 'TRY'
  status: SubscriptionInvoiceStatus
  periodStart: string
  periodEnd: string
  dueAt: string
  paidAt: string | null
  failedAt: string | null
  canRetry: boolean
}

export type SubscriptionBillingSettingsRefund = {
  id: string
  invoiceId: string
  kind: 'same_day_cancel' | 'refund'
  scope: 'full' | 'partial'
  accessAction: 'keep' | 'cancel_immediately'
  amountMinor: number
  currency: 'TRY'
  status: 'requested' | 'processing' | 'succeeded' | 'failed' | 'requires_reconciliation'
  requestedAt: string
  completedAt: string | null
  cancellationRequestId: string | null
  cancellationStatus: 'scheduled' | 'processing' | 'provider_cancelled' | 'applied' | 'requires_reconciliation' | null
}

/** Owner-facing, tenant-scoped projection. Provider references, raw errors and
 * payment credentials deliberately never cross this read boundary. */
export type SubscriptionBillingSettings = {
  profile: SubscriptionBillingProfile | null
  subscription: SubscriptionBillingSettingsSubscription | null
  invoices: SubscriptionBillingSettingsInvoice[]
  /** Read-only money history; provider references and internal reasons stay private. */
  refunds: SubscriptionBillingSettingsRefund[]
  attention: {
    reconciliationCount: number
    hasPendingCheckout: boolean
    nextDunningActionAt: string | null
  }
}

export interface SubscriptionBillingSettingsReadPort {
  readSettings(input: { restaurantId: string }): Promise<Result<SubscriptionBillingSettings>>
}

export async function readSubscriptionBillingSettings(
  context: DashboardActorContext,
  restaurantId: string,
  port: SubscriptionBillingSettingsReadPort,
): Promise<Result<SubscriptionBillingSettings>> {
  if (!dashboardOwnerMatches(context, restaurantId)) return err('Billing owner context required')
  return port.readSettings({ restaurantId })
}

export type SubscriptionProviderStatus =
  | 'active' | 'pending' | 'unpaid' | 'cancelled' | 'expired' | 'upgraded'

export type BillingProviderOperationStatus =
  | 'processing'
  | 'awaiting_callback'
  | 'succeeded'
  | 'requires_reconciliation'
  | 'expired'

export type BillingCheckoutActiveResult = {
  providerCustomerRef: string
  providerSubscriptionRef: string
  providerPlanRef: string
  providerInvoiceRef: string
  providerPaymentId: string
  providerOrderStatus: 'succeeded'
  amount: BillingAmount
  periodStart: string
  periodEnd: string
  status: 'active'
}

export type BillingCheckoutProbeResult =
  | { outcome: 'active'; checkout: BillingCheckoutActiveResult }
  | { outcome: 'incomplete' }
  | { outcome: 'expired' }
  | { outcome: 'ambiguous' }

export type BillingSubscriptionOrderEvidence = {
  providerCustomerRef: string
  providerSubscriptionRef: string
  providerInvoiceRef: string
  /** Present only for a provider-authenticated successful payment attempt. */
  providerPaymentId: string | null
  providerPlanRef: string
  plan: SelfServePlan
  addOns: RestaurantAddOn[]
  billingInterval: BillingInterval
  amount: BillingAmount
  periodStart: string
  periodEnd: string
  status: 'succeeded' | 'failed' | 'pending'
}

export interface SubscriptionRenewalProvider {
  retrieveSubscriptionOrder(input: {
    providerCustomerRef: string
    providerSubscriptionRef: string
    providerInvoiceRef: string
    idempotencyKey: string
  }): Promise<Result<BillingSubscriptionOrderEvidence>>
}

export type BillingPlanChangePreparation = {
  changeRequestId: string
  operationId: string
  subscriptionId: string
  providerSubscriptionRef: string
  providerTargetPlanRef: string
  fromPlan: SelfServePlan
  toPlan: SelfServePlan
  billingInterval: BillingInterval
  effectivePolicy: 'next_period'
  effectiveAt: string
  status: 'processing' | 'scheduled' | 'requires_reconciliation'
  dispatchable: boolean
  duplicate: boolean
}

export type BillingProviderPlanChangeResult = {
  providerParentSubscriptionRef: string
  providerTargetSubscriptionRef: string
  providerTargetPlanRef: string
  providerStatus: 'active'
  providerPeriodStart: string
  providerPeriodEnd: string
}

export interface SubscriptionPlanChangeProvider {
  upgradeSubscription(input: {
    providerSubscriptionRef: string
    providerTargetPlanRef: string
    effectivePolicy: 'next_period'
    idempotencyKey: string
  }): Promise<Result<BillingProviderPlanChangeResult>>
}

export type BillingCardUpdatePreparation = {
  operationId: string
  subscriptionId: string
  providerSubscriptionRef: string
  status: BillingProviderOperationStatus
  providerCheckoutRef: string | null
  expiresAt: string | null
  dispatchable: boolean
  duplicate: boolean
}

export type BillingProviderCardUpdateSession = {
  providerCheckoutRef: string
  checkoutContent: string
  expiresAt: string | null
}

export interface SubscriptionCardUpdateProvider {
  initializeSubscriptionCardUpdate(input: {
    providerSubscriptionRef: string
    callbackUrl: string
    idempotencyKey: string
  }): Promise<Result<BillingProviderCardUpdateSession>>
}

export interface SubscriptionCardUpdatePort {
  prepareCardUpdate(input: {
    restaurantId: string
    idempotencyKey: string
    requestFingerprint: string
    callbackStateHash: string
  }): Promise<Result<BillingCardUpdatePreparation>>
  markCardUpdateInitialized(input: {
    operationId: string
    providerCheckoutRef: string
    expiresAt: string | null
  }): Promise<Result<true>>
  completeCardUpdate(input: {
    providerCheckoutRef: string
    callbackState: string
    occurredAt: string
  }): Promise<Result<{
    operationId: string
    restaurantId: string
    subscriptionId: string
    outcome: 'succeeded' | 'ambiguous'
    duplicate: boolean
  }>>
}

export interface SubscriptionPlanChangePort {
  preparePlanChange(input: {
    restaurantId: string
    toPlan: SelfServePlan
    toAddOns: RestaurantAddOn[]
    toBillingInterval: BillingInterval
    providerTargetPlanRef: string
    effectivePolicy: 'next_period'
    idempotencyKey: string
    requestFingerprint: string
    requestedBy: string
  }): Promise<Result<BillingPlanChangePreparation>>
  finalizePlanChange(input: {
    operationId: string
    changeRequestId: string
    result: BillingProviderPlanChangeResult
    occurredAt: string
  }): Promise<Result<{
    changeRequestId: string
    subscriptionId: string
    status: 'scheduled'
    effectiveAt: string
    duplicate: boolean
  }>>
}

export interface SubscriptionCancellationSchedulePort {
  scheduleCancellation(input: {
    restaurantId: string
    idempotencyKey: string
    requestFingerprint: string
    requestedBy: string
    occurredAt: string
  }): Promise<Result<{
    cancellationRequestId: string
    subscriptionId: string
    status: 'scheduled' | 'processing' | 'provider_cancelled' | 'applied' | 'withdrawn' | 'requires_reconciliation'
    effectiveAt: string
    duplicate: boolean
  }>>
  withdrawCancellation(input: {
    restaurantId: string
    cancellationRequestId: string
    idempotencyKey: string
    requestFingerprint: string
    withdrawnBy: string
    occurredAt: string
  }): Promise<Result<{
    cancellationRequestId: string
    subscriptionId: string
    status: 'withdrawn'
    duplicate: boolean
  }>>
}

export type BillingCheckoutRecoveryJob = {
  operationId: string
  restaurantId: string
  providerCheckoutRef: string
  expectedProviderPlanRef: string
  expectedAmount: BillingAmount
  expectedBillingInterval: BillingInterval
  expiresAt: string
  attempts: number
}

export type BillingCheckoutRecoveryOutcome =
  | {
    outcome: 'active'
    restaurantId: string
    subscriptionId: string
    invoiceId: string
    invoiceStatus: 'paid'
    paymentEvidence: 'authenticated_retrieve'
    duplicate: boolean
  }
  | { outcome: 'incomplete' }
  | { outcome: 'expired' }
  | { outcome: 'ambiguous' }

export type BillingCheckoutPreparation = {
  operationId: string
  customerId: string
  invoiceId: string
  profile: SubscriptionBillingProfile
  plan: SelfServePlan
  addOns?: RestaurantAddOn[]
  interval: BillingInterval
  amount: BillingAmount
  dispatchable: boolean
  duplicate: boolean
  providerCheckoutRef: string | null
  status: BillingProviderOperationStatus
}

export type BillingRetryPreparation = {
  operationId: string
  invoiceId: string
  providerPaymentRef: string
  dispatchable: boolean
  duplicate: boolean
  status: BillingProviderOperationStatus
}

export type BillingCancellationPreparation = {
  operationId: string
  subscriptionId: string
  providerSubscriptionRef: string
  dispatchable: boolean
  duplicate: boolean
  status: BillingProviderOperationStatus
}

export interface SubscriptionBillingOperationsPort {
  saveProfile(input: {
    restaurantId: string
    profile: SubscriptionBillingProfile
  }): Promise<Result<{ customerId: string }>>
  prepareCheckout(input: {
    restaurantId: string
    profile: SubscriptionBillingProfile
    plan: SelfServePlan
    addOns?: RestaurantAddOn[]
    interval: BillingInterval
    amount: BillingAmount
    periodStart: string
    periodEnd: string
    dueAt: string
    expectedProviderPlanRef?: string
    idempotencyKey: string
    requestFingerprint: string
  }): Promise<Result<BillingCheckoutPreparation>>
  markCheckoutInitialized(input: {
    operationId: string
    providerCheckoutRef: string
    expiresAt: string | null
  }): Promise<Result<true>>
  bindCheckoutProviderPlan(input: {
    operationId: string
    expectedProviderPlanRef: string
  }): Promise<Result<true>>
  findCheckoutCallback(providerCheckoutRef: string): Promise<Result<{
    operationId: string
    restaurantId: string
    invoiceId: string
    requestedPlan: SelfServePlan
    expectedProviderPlanRef: string
    expectedAmount: BillingAmount
    expectedBillingInterval: BillingInterval
    expiresAt: string
    attempts: number
  }>>
  finalizeCheckout(input: {
    operationId: string
    providerCustomerRef: string
    providerSubscriptionRef: string
    providerPlanRef: string
    providerInvoiceRef: string
    providerPaymentId: string
    providerOrderStatus: 'succeeded'
    amount: BillingAmount
    providerStatus: SubscriptionProviderStatus
    periodStart: string
    periodEnd: string
  }): Promise<Result<{
    restaurantId: string
    subscriptionId: string
    invoiceId: string
    invoiceStatus: 'paid'
    paymentEvidence: 'authenticated_retrieve'
    duplicate: boolean
  }>>
  prepareRetry(input: {
    restaurantId: string
    invoiceId: string
    idempotencyKey: string
    requestFingerprint: string
  }): Promise<Result<BillingRetryPreparation>>
  prepareCancellation(input: {
    restaurantId: string
    idempotencyKey: string
    requestFingerprint: string
  }): Promise<Result<BillingCancellationPreparation>>
  completeOperation(input: {
    operationId: string
    result: Record<string, unknown>
  }): Promise<Result<true>>
  markOperationForReconciliation(input: {
    operationId: string
    reason: string
  }): Promise<Result<true>>
  finalizeCancellation(input: {
    operationId: string
    cancelledAt: string
    actorUserId: string
    requestId: string
  }): Promise<Result<{ subscriptionId: string; duplicate: boolean }>>
}

export interface SubscriptionCheckoutRecoveryPort {
  claimCheckoutRecoveryOperation(input: {
    restaurantId: string
    operationId: string
    workerId: string
    leaseSeconds: number
  }): Promise<Result<BillingCheckoutRecoveryJob>>
  rescheduleCheckoutRecovery(input: {
    operationId: string
    workerId: string | null
    nextAt: string
    reason: string | null
  }): Promise<Result<true>>
  expireCheckoutRecovery(input: {
    operationId: string
    workerId: string | null
  }): Promise<Result<true>>
}

/** Signature verification is deliberately narrower than the full provider
 * API. Webhook routes do not gain checkout/customer capabilities merely by
 * importing a verifier. */
export type SubscriptionBillingWebhookVerifier = Pick<SubscriptionBillingProvider, 'verifyWebhook'>

/** Keeps signature verification and event normalization behind the provider
 * adapter while rejecting structurally unusable events before persistence. */
export async function verifySubscriptionBillingWebhook(
  input: { rawBody: Uint8Array; headers: Readonly<Record<string, string | undefined>> },
  provider: SubscriptionBillingWebhookVerifier,
): Promise<Result<VerifiedSubscriptionBillingEvent>> {
  if (input.rawBody.byteLength === 0) return err('Webhook body is required')
  const verified = await provider.verifyWebhook(input)
  if (!verified.ok) return verified
  if (!verified.value.eventId.trim()) return err('Provider event id is required')
  if (!Number.isFinite(Date.parse(verified.value.occurredAt))) return err('Provider event timestamp is invalid')
  if (!verified.value.payloadHash.trim()) return err('Provider payload hash is required')
  return verified
}

export type SubscriptionBillingWebhookInboxResult = {
  providerEventId: string
  restaurantId: string | null
  subscriptionId: string | null
  invoiceId: string | null
  amount: BillingAmount | null
  duplicate: boolean
  dispatchable: boolean
  alreadyProcessed: boolean
}

export interface SubscriptionBillingWebhookInboxPort {
  ingest(event: VerifiedSubscriptionBillingEvent): Promise<Result<SubscriptionBillingWebhookInboxResult>>
  markFailed(input: {
    providerEventId: string
    reason: string
    sanitizedPayload: Record<string, unknown>
  }): Promise<Result<true>>
}

export type ProcessSubscriptionBillingWebhookResult = {
  providerEventId: string
  outcome: 'processed' | 'duplicate' | 'queued_for_reconciliation'
}

/** Durable webhook orchestration. Verification happens before service-role
 * persistence; the provider event inbox is written before an aggregate
 * transition; money is always read from the locally locked invoice mapping. */
export async function processSubscriptionBillingWebhook(
  input: { rawBody: Uint8Array; headers: Readonly<Record<string, string | undefined>> },
  verifier: SubscriptionBillingWebhookVerifier,
  inbox: SubscriptionBillingWebhookInboxPort,
  billing: SubscriptionBillingPersistencePort,
): Promise<Result<ProcessSubscriptionBillingWebhookResult>> {
  const verified = await verifySubscriptionBillingWebhook(input, verifier)
  if (!verified.ok) return verified
  if (verified.value.type !== 'invoice.payment_succeeded'
    && verified.value.type !== 'invoice.payment_failed') {
    return err('Unsupported subscription billing webhook event')
  }

  const accepted = await inbox.ingest(verified.value)
  if (!accepted.ok) return accepted
  if (accepted.value.alreadyProcessed) {
    return ok({ providerEventId: accepted.value.providerEventId, outcome: 'duplicate' })
  }
  const { restaurantId, subscriptionId, invoiceId, amount } = accepted.value
  if (!accepted.value.dispatchable || !restaurantId || !subscriptionId || !invoiceId || !amount) {
    return ok({
      providerEventId: accepted.value.providerEventId,
      outcome: 'queued_for_reconciliation',
    })
  }

  const context: PaymentProviderContext = {
    actor: 'payment-provider',
    provider: 'iyzico',
    restaurantId,
  }
  const idempotencyKey = `iyzico-webhook:${verified.value.eventId}`
  const transitioned = verified.value.type === 'invoice.payment_succeeded'
    ? await recordSubscriptionPaymentSuccess(context, {
      restaurantId,
      subscriptionId,
      invoiceId,
      providerEventId: accepted.value.providerEventId,
      providerAttemptRef: verified.value.providerAttemptRef,
      amount,
      occurredAt: verified.value.occurredAt,
      idempotencyKey,
    }, billing)
    : await recordSubscriptionPaymentFailure(context, {
      restaurantId,
      subscriptionId,
      invoiceId,
      providerEventId: accepted.value.providerEventId,
      providerAttemptRef: verified.value.providerAttemptRef,
      amount,
      failureCode: 'provider_payment_failed',
      failureMessage: 'Iyzico subscription payment failed',
      occurredAt: verified.value.occurredAt,
      idempotencyKey,
    }, billing)

  if (!transitioned.ok) {
    const marked = await inbox.markFailed({
      providerEventId: accepted.value.providerEventId,
      reason: transitioned.error,
      sanitizedPayload: verified.value.sanitizedPayload,
    })
    if (!marked.ok) return err(`Webhook transition failed; inbox recovery also failed: ${marked.error}`)
    return transitioned
  }
  return ok({
    providerEventId: accepted.value.providerEventId,
    outcome: 'processed',
  })
}

export type CreateSubscriptionInvoiceInput = {
  restaurantId: string
  subscriptionId: string
  plan: SelfServePlan
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
  if (!['starter', 'plus', 'pro'].includes(input.plan)) return err('Self-serve billing plan is required')
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

function dashboardOwnerMatches(context: DashboardActorContext, restaurantId: string): boolean {
  return context.restaurantId === restaurantId && context.isOwner === true
}

function validBillingAddress(address: SubscriptionBillingAddress): boolean {
  const required = [address.contactName, address.city, address.country, address.address]
  return required.every((value) => value.trim().length > 0 && value.trim().length <= 500)
    && (!address.district || address.district.trim().length <= 100)
    && (!address.zipCode || address.zipCode.trim().length <= 20)
}

function validBillingProfile(profile: SubscriptionBillingProfile): boolean {
  return profile.legalName.trim().length > 0 && profile.legalName.trim().length <= 200
    && profile.taxOffice.trim().length > 0 && profile.taxOffice.trim().length <= 100
    && profile.name.trim().length > 0 && profile.name.trim().length <= 100
    && profile.surname.trim().length > 0 && profile.surname.trim().length <= 100
    && /^\d{10,11}$/.test(profile.identityNumber.trim())
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email.trim())
    && /^\+?[0-9]{10,15}$/.test(profile.gsmNumber.replace(/[\s()-]/g, ''))
    && validBillingAddress(profile.billingAddress)
    && validBillingAddress(profile.shippingAddress)
}

function validOperationInput(input: { idempotencyKey: string; requestFingerprint: string }): boolean {
  return input.idempotencyKey.trim().length > 0 && input.idempotencyKey.trim().length <= 160
    && /^[a-f0-9]{64}$/.test(input.requestFingerprint)
}

export async function saveSubscriptionBillingProfile(
  context: DashboardActorContext,
  input: { restaurantId: string; profile: SubscriptionBillingProfile },
  port: SubscriptionBillingOperationsPort,
): Promise<Result<{ customerId: string }>> {
  if (!dashboardOwnerMatches(context, input.restaurantId)) return err('Billing owner context required')
  if (!validBillingProfile(input.profile)) return err('Billing profile is invalid')
  return port.saveProfile(input)
}

export async function startSubscriptionCheckout(
  context: DashboardActorContext,
  input: {
    restaurantId: string
    profile: SubscriptionBillingProfile
    plan: SelfServePlan
    addOns?: readonly RestaurantAddOn[]
    interval: BillingInterval
    amount: BillingAmount
    periodStart: string
    periodEnd: string
    dueAt: string
    callbackUrl: string
    expectedProviderPlanRef: string
    idempotencyKey: string
    requestFingerprint: string
  },
  port: SubscriptionBillingOperationsPort,
  provider: SubscriptionBillingProvider,
): Promise<Result<{
  operationId: string
  providerCheckoutRef: string
  checkoutContent: string | null
  expiresAt: string | null
  duplicate: boolean
}>> {
  if (!dashboardOwnerMatches(context, input.restaurantId)) return err('Billing owner context required')
  if (!validBillingProfile(input.profile) || !validOperationInput(input)) return err('Billing checkout input is invalid')
  const addOns = [...(input.addOns ?? [])]
  if (!['starter', 'plus', 'pro'].includes(input.plan)
    || !isValidAddOnSelection(input.plan, addOns)
    || !['monthly', 'annual'].includes(input.interval)
    || !Number.isSafeInteger(input.amount.minor) || input.amount.minor <= 0
    || input.amount.currency !== 'TRY'
    || !/^[\x21-\x7e]{1,200}$/.test(input.expectedProviderPlanRef)
    || !validTimestamp(input.periodStart) || !validTimestamp(input.periodEnd)
    || !validTimestamp(input.dueAt) || Date.parse(input.periodEnd) <= Date.parse(input.periodStart)) {
    return err('Billing checkout input is invalid')
  }

  const prepared = await port.prepareCheckout({ ...input, addOns })
  if (!prepared.ok) return prepared
  if (!prepared.value.dispatchable) {
    return prepared.value.providerCheckoutRef
      ? ok({
        operationId: prepared.value.operationId,
        providerCheckoutRef: prepared.value.providerCheckoutRef,
        checkoutContent: null,
        expiresAt: null,
        duplicate: true,
      })
      : err('Billing checkout operation is already in progress')
  }

  const bound = await port.bindCheckoutProviderPlan({
    operationId: prepared.value.operationId,
    expectedProviderPlanRef: input.expectedProviderPlanRef,
  })
  if (!bound.ok) {
    const marked = await port.markOperationForReconciliation({
      operationId: prepared.value.operationId,
      reason: bound.error,
    })
    return marked.ok
      ? err('Billing checkout provider plan binding requires reconciliation')
      : err('Billing checkout provider plan binding and reconciliation tracking failed')
  }

  const checkout = await provider.createCheckout({
    customer: prepared.value.profile,
    invoiceId: prepared.value.invoiceId,
    plan: prepared.value.plan,
    addOns: prepared.value.addOns ?? [],
    interval: prepared.value.interval,
    amount: prepared.value.amount,
    callbackUrl: input.callbackUrl,
    idempotencyKey: input.idempotencyKey,
  })
  if (!checkout.ok) {
    const marked = await port.markOperationForReconciliation({
      operationId: prepared.value.operationId,
      reason: checkout.error,
    })
    if (!marked.ok) return err('Billing checkout failed and reconciliation tracking failed')
    return checkout
  }
  if (checkout.value.providerPlanRef !== input.expectedProviderPlanRef) {
    const marked = await port.markOperationForReconciliation({
      operationId: prepared.value.operationId,
      reason: 'Hosted checkout used an unexpected provider plan reference',
    })
    return marked.ok
      ? err('Billing checkout provider plan mismatch')
      : err('Billing checkout provider plan mismatch and reconciliation tracking failed')
  }
  const marked = await port.markCheckoutInitialized({
    operationId: prepared.value.operationId,
    providerCheckoutRef: checkout.value.providerCheckoutRef,
    expiresAt: checkout.value.expiresAt,
  })
  if (!marked.ok) {
    const reconciled = await port.markOperationForReconciliation({
      operationId: prepared.value.operationId,
      reason: marked.error,
    })
    return reconciled.ok
      ? err('Billing checkout initialization requires reconciliation')
      : err('Billing checkout initialization and reconciliation tracking failed')
  }
  return ok({
    operationId: prepared.value.operationId,
    providerCheckoutRef: checkout.value.providerCheckoutRef,
    checkoutContent: checkout.value.checkoutContent,
    expiresAt: checkout.value.expiresAt,
    duplicate: false,
  })
}

function checkoutRecoveryDelaySeconds(attempts: number): number {
  const delays = [2, 4, 8, 15, 30, 45, 60] as const
  return delays[Math.min(Math.max(0, attempts - 1), delays.length - 1)]!
}

export async function recoverClaimedSubscriptionCheckout(
  job: BillingCheckoutRecoveryJob,
  input: { workerId: string | null; occurredAt?: string },
  port: SubscriptionBillingOperationsPort & SubscriptionCheckoutRecoveryPort,
  provider: Pick<SubscriptionBillingProvider, 'probeCheckout'>,
): Promise<Result<BillingCheckoutRecoveryOutcome>> {
  const occurredAt = input.occurredAt ?? new Date().toISOString()
  if (!validId(job.operationId) || !validId(job.restaurantId)
    || !validId(job.providerCheckoutRef) || !validId(job.expectedProviderPlanRef)
    || !job.expectedAmount || !Number.isSafeInteger(job.expectedAmount.minor) || job.expectedAmount.minor <= 0
    || job.expectedAmount.currency !== 'TRY'
    || !['monthly', 'annual'].includes(job.expectedBillingInterval)
    || !validTimestamp(job.expiresAt) || !Number.isInteger(job.attempts) || job.attempts < 1
    || !validTimestamp(occurredAt)) {
    return err('Billing checkout recovery input is invalid')
  }

  const schedule = async (reason: string | null) => port.rescheduleCheckoutRecovery({
    operationId: job.operationId,
    workerId: input.workerId,
    nextAt: new Date(Date.parse(occurredAt) + checkoutRecoveryDelaySeconds(job.attempts) * 1_000).toISOString(),
    reason,
  })
  const expire = async (): Promise<Result<BillingCheckoutRecoveryOutcome>> => {
    const expired = await port.expireCheckoutRecovery({ operationId: job.operationId, workerId: input.workerId })
    return expired.ok ? ok({ outcome: 'expired' }) : expired
  }

  const probe = await provider.probeCheckout({
    providerCheckoutRef: job.providerCheckoutRef,
    expectedProviderPlanRef: job.expectedProviderPlanRef,
    expectedAmount: job.expectedAmount,
    expectedBillingInterval: job.expectedBillingInterval,
    idempotencyKey: `billing:checkout-probe:${job.operationId}:${job.attempts}`,
  })
  if (!probe.ok) {
    if (job.attempts >= 8) {
      const marked = await port.markOperationForReconciliation({
        operationId: job.operationId,
        reason: 'Checkout recovery provider probe failed repeatedly',
      })
      return marked.ok ? ok({ outcome: 'ambiguous' }) : marked
    }
    const scheduled = await schedule('Checkout recovery provider probe failed')
    return scheduled.ok ? ok({ outcome: 'ambiguous' }) : scheduled
  }

  if (probe.value.outcome === 'active') {
    const finalized = await port.finalizeCheckout({
      operationId: job.operationId,
      ...probe.value.checkout,
      providerStatus: 'active',
    })
    if (!finalized.ok) {
      const marked = await port.markOperationForReconciliation({
        operationId: job.operationId,
        reason: 'Active checkout could not be finalized atomically',
      })
      return marked.ok ? ok({ outcome: 'ambiguous' }) : marked
    }
    return ok({ outcome: 'active', ...finalized.value })
  }

  if (probe.value.outcome === 'expired' || Date.parse(occurredAt) >= Date.parse(job.expiresAt)) {
    return expire()
  }
  if (probe.value.outcome === 'incomplete') {
    const scheduled = await schedule(null)
    return scheduled.ok ? ok({ outcome: 'incomplete' }) : scheduled
  }
  if (job.attempts >= 8) {
    const marked = await port.markOperationForReconciliation({
      operationId: job.operationId,
      reason: 'Checkout recovery remained ambiguous',
    })
    return marked.ok ? ok({ outcome: 'ambiguous' }) : marked
  }
  const scheduled = await schedule('Checkout recovery result was ambiguous')
  return scheduled.ok ? ok({ outcome: 'ambiguous' }) : scheduled
}

export async function recoverSubscriptionCheckout(
  context: DashboardActorContext,
  input: { restaurantId: string; operationId: string; workerId: string },
  port: SubscriptionBillingOperationsPort & SubscriptionCheckoutRecoveryPort,
  provider: Pick<SubscriptionBillingProvider, 'probeCheckout'>,
): Promise<Result<BillingCheckoutRecoveryOutcome>> {
  if (!dashboardOwnerMatches(context, input.restaurantId)) return err('Billing owner context required')
  if (!validId(input.operationId) || !validId(input.workerId) || input.workerId.length > 160) {
    return err('Billing checkout recovery input is invalid')
  }
  const claimed = await port.claimCheckoutRecoveryOperation({
    restaurantId: input.restaurantId,
    operationId: input.operationId,
    workerId: input.workerId,
    leaseSeconds: 10,
  })
  if (!claimed.ok) return claimed
  return recoverClaimedSubscriptionCheckout(claimed.value, { workerId: input.workerId }, port, provider)
}

export async function completeSubscriptionCheckout(
  input: { providerCheckoutRef: string; idempotencyKey: string },
  port: SubscriptionBillingOperationsPort & SubscriptionCheckoutRecoveryPort,
  provider: SubscriptionBillingProvider,
): Promise<Result<BillingCheckoutRecoveryOutcome>> {
  if (!validId(input.providerCheckoutRef)
    || !validId(input.idempotencyKey)
    || input.idempotencyKey.trim().length > 160) {
    return err('Billing checkout callback input is invalid')
  }
  const pending = await port.findCheckoutCallback(input.providerCheckoutRef)
  if (!pending.ok) return pending
  return recoverClaimedSubscriptionCheckout({
    operationId: pending.value.operationId,
    restaurantId: pending.value.restaurantId,
    providerCheckoutRef: input.providerCheckoutRef,
    expectedProviderPlanRef: pending.value.expectedProviderPlanRef,
    expectedAmount: pending.value.expectedAmount,
    expectedBillingInterval: pending.value.expectedBillingInterval,
    expiresAt: pending.value.expiresAt,
    attempts: Math.max(1, pending.value.attempts),
  }, { workerId: null }, port, provider)
}

export async function retrySubscriptionInvoice(
  context: DashboardActorContext,
  input: { restaurantId: string; invoiceId: string; idempotencyKey: string; requestFingerprint: string },
  port: SubscriptionBillingOperationsPort,
  provider: SubscriptionBillingProvider,
): Promise<Result<{ accepted: true; duplicate: boolean }>> {
  if (!dashboardOwnerMatches(context, input.restaurantId)) return err('Billing owner context required')
  if (!validId(input.invoiceId) || !validOperationInput(input)) return err('Billing retry input is invalid')
  const prepared = await port.prepareRetry(input)
  if (!prepared.ok) return prepared
  if (!prepared.value.dispatchable) {
    return prepared.value.status === 'succeeded'
      ? ok({ accepted: true, duplicate: true })
      : err('Billing retry operation is already in progress')
  }
  const retried = await provider.retryInvoice({
    providerPaymentRef: prepared.value.providerPaymentRef,
    invoiceId: prepared.value.invoiceId,
    idempotencyKey: input.idempotencyKey,
  })
  if (!retried.ok) {
    const marked = await port.markOperationForReconciliation({
      operationId: prepared.value.operationId,
      reason: retried.error,
    })
    if (!marked.ok) return err('Billing retry failed and reconciliation tracking failed')
    return retried
  }
  const completed = await port.completeOperation({ operationId: prepared.value.operationId, result: { accepted: true } })
  if (!completed.ok) {
    const marked = await port.markOperationForReconciliation({
      operationId: prepared.value.operationId,
      reason: completed.error,
    })
    return marked.ok
      ? err('Billing retry requires reconciliation')
      : err('Billing retry completion and reconciliation tracking failed')
  }
  return ok({ accepted: true, duplicate: false })
}

/** Records an owner request for provider cancellation at the already-paid
 * period boundary. This step never calls the provider or closes access. */
export async function scheduleTenantSubscriptionCancellation(
  context: DashboardActorContext,
  input: {
    restaurantId: string
    idempotencyKey: string
    requestFingerprint: string
    occurredAt?: string
  },
  port: SubscriptionCancellationSchedulePort,
): Promise<Result<{
  cancellationRequestId: string
  subscriptionId: string
  status: 'scheduled'
  effectiveAt: string
  duplicate: boolean
}>> {
  if (!dashboardOwnerMatches(context, input.restaurantId)) return err('Billing owner context required')
  if (!validOperationInput(input)) return err('Billing cancellation schedule input is invalid')
  const occurredAt = input.occurredAt ?? new Date().toISOString()
  if (!validTimestamp(occurredAt)) return err('Billing cancellation schedule timestamp is invalid')
  const scheduled = await port.scheduleCancellation({
    restaurantId: input.restaurantId,
    idempotencyKey: input.idempotencyKey,
    requestFingerprint: input.requestFingerprint,
    requestedBy: context.userId,
    occurredAt,
  })
  if (!scheduled.ok) return scheduled
  return scheduled.value.status === 'scheduled'
    ? ok({ ...scheduled.value, status: 'scheduled' })
    : err('Billing cancellation request is no longer schedulable')
}

/** Withdraws a still-local period-end request before the due worker claims it. */
export async function withdrawTenantSubscriptionCancellation(
  context: DashboardActorContext,
  input: {
    restaurantId: string
    cancellationRequestId: string
    idempotencyKey: string
    requestFingerprint: string
    occurredAt?: string
  },
  port: SubscriptionCancellationSchedulePort,
): Promise<Result<{
  cancellationRequestId: string
  subscriptionId: string
  status: 'withdrawn'
  duplicate: boolean
}>> {
  if (!dashboardOwnerMatches(context, input.restaurantId)) return err('Billing owner context required')
  if (!validId(input.cancellationRequestId) || !validOperationInput(input)) {
    return err('Billing cancellation withdrawal input is invalid')
  }
  const occurredAt = input.occurredAt ?? new Date().toISOString()
  if (!validTimestamp(occurredAt)) return err('Billing cancellation withdrawal timestamp is invalid')
  return port.withdrawCancellation({
    restaurantId: input.restaurantId,
    cancellationRequestId: input.cancellationRequestId,
    idempotencyKey: input.idempotencyKey,
    requestFingerprint: input.requestFingerprint,
    withdrawnBy: context.userId,
    occurredAt,
  })
}

/** Immediate cancellation is reserved for separately authorized support/legal
 * operations. Owner self-service uses scheduleTenantSubscriptionCancellation. */
export async function cancelTenantSubscription(
  context: DashboardActorContext,
  input: { restaurantId: string; idempotencyKey: string; requestFingerprint: string },
  port: SubscriptionBillingOperationsPort,
  provider: SubscriptionBillingProvider,
): Promise<Result<{ subscriptionId: string; duplicate: boolean }>> {
  if (!dashboardOwnerMatches(context, input.restaurantId)) return err('Billing owner context required')
  if (!validOperationInput(input)) return err('Billing cancellation input is invalid')
  const prepared = await port.prepareCancellation(input)
  if (!prepared.ok) return prepared
  if (!prepared.value.dispatchable && prepared.value.status !== 'succeeded') {
    return err('Billing cancellation operation is already in progress')
  }
  let cancelledAt = new Date().toISOString()
  if (prepared.value.dispatchable) {
    const cancelled = await provider.cancelSubscription({
      providerSubscriptionRef: prepared.value.providerSubscriptionRef,
      idempotencyKey: input.idempotencyKey,
    })
    if (!cancelled.ok) {
      const marked = await port.markOperationForReconciliation({
        operationId: prepared.value.operationId,
        reason: cancelled.error,
      })
      if (!marked.ok) return err('Billing cancellation failed and reconciliation tracking failed')
      return cancelled
    }
    cancelledAt = cancelled.value.cancelledAt ?? cancelledAt
    const completed = await port.completeOperation({
      operationId: prepared.value.operationId,
      result: { cancelledAt: cancelled.value.cancelledAt },
    })
    if (!completed.ok) {
      const marked = await port.markOperationForReconciliation({
        operationId: prepared.value.operationId,
        reason: completed.error,
      })
      return marked.ok
        ? err('Billing cancellation requires reconciliation')
        : err('Billing cancellation completion and reconciliation tracking failed')
    }
  }
  return port.finalizeCancellation({
    operationId: prepared.value.operationId,
    cancelledAt,
    actorUserId: context.userId,
    requestId: input.idempotencyKey,
  })
}

/**
 * Schedules a same-interval plan change at the next paid renewal. Provider
 * acceptance alone never changes the local plan or entitlements.
 */
export async function scheduleSubscriptionPlanChange(
  context: DashboardActorContext,
  input: {
    restaurantId: string
    toPlan: SelfServePlan
    toAddOns?: readonly RestaurantAddOn[]
    toBillingInterval: BillingInterval
    providerTargetPlanRef: string
    effectivePolicy: 'next_period'
    idempotencyKey: string
    requestFingerprint: string
    occurredAt?: string
  },
  port: SubscriptionPlanChangePort & Pick<SubscriptionBillingOperationsPort, 'markOperationForReconciliation'>,
  provider: SubscriptionPlanChangeProvider,
): Promise<Result<{
  changeRequestId: string
  subscriptionId: string
  status: 'scheduled'
  effectiveAt: string
  duplicate: boolean
}>> {
  if (!dashboardOwnerMatches(context, input.restaurantId)) return err('Billing owner context required')
  const toAddOns = [...(input.toAddOns ?? [])]
  if (!['starter', 'plus', 'pro'].includes(input.toPlan)
    || !['monthly', 'annual'].includes(input.toBillingInterval)
    || input.effectivePolicy !== 'next_period'
    || !isValidAddOnSelection(input.toPlan, toAddOns)
    || !/^[\x21-\x7e]{1,200}$/.test(input.providerTargetPlanRef)
    || !validOperationInput(input)) {
    return err('Billing plan change input is invalid')
  }
  const occurredAt = input.occurredAt ?? new Date().toISOString()
  if (!validTimestamp(occurredAt)) return err('Billing plan change timestamp is invalid')

  const prepared = await port.preparePlanChange({
    restaurantId: input.restaurantId,
    toPlan: input.toPlan,
    toAddOns,
    toBillingInterval: input.toBillingInterval,
    providerTargetPlanRef: input.providerTargetPlanRef,
    effectivePolicy: input.effectivePolicy,
    idempotencyKey: input.idempotencyKey,
    requestFingerprint: input.requestFingerprint,
    requestedBy: context.userId,
  })
  if (!prepared.ok) return prepared
  if (!prepared.value.dispatchable) {
    return prepared.value.status === 'scheduled'
      ? ok({
        changeRequestId: prepared.value.changeRequestId,
        subscriptionId: prepared.value.subscriptionId,
        status: 'scheduled',
        effectiveAt: prepared.value.effectiveAt,
        duplicate: true,
      })
      : err('Billing plan change operation is already in progress')
  }

  const upgraded = await provider.upgradeSubscription({
    providerSubscriptionRef: prepared.value.providerSubscriptionRef,
    providerTargetPlanRef: prepared.value.providerTargetPlanRef,
    effectivePolicy: prepared.value.effectivePolicy,
    idempotencyKey: input.idempotencyKey,
  })
  if (!upgraded.ok) {
    const marked = await port.markOperationForReconciliation({
      operationId: prepared.value.operationId,
      reason: upgraded.error,
    })
    return marked.ok ? upgraded : err('Billing plan change failed and reconciliation tracking failed')
  }
  const finalized = await port.finalizePlanChange({
    operationId: prepared.value.operationId,
    changeRequestId: prepared.value.changeRequestId,
    result: upgraded.value,
    occurredAt,
  })
  if (finalized.ok) return finalized
  const marked = await port.markOperationForReconciliation({
    operationId: prepared.value.operationId,
    reason: finalized.error,
  })
  return marked.ok
    ? err('Billing plan change requires reconciliation')
    : err('Billing plan change finalization and reconciliation tracking failed')
}

/** Starts iyzico's hosted card-update form. The platform never receives card
 * fields; provider initialization is not treated as a successful update. */
export async function startSubscriptionCardUpdate(
  context: DashboardActorContext,
  input: {
    restaurantId: string
    callbackUrl: string
    callbackStateHash: string
    idempotencyKey: string
    requestFingerprint: string
  },
  port: SubscriptionCardUpdatePort & Pick<SubscriptionBillingOperationsPort, 'markOperationForReconciliation'>,
  provider: SubscriptionCardUpdateProvider,
): Promise<Result<{
  operationId: string
  providerCheckoutRef: string | null
  checkoutContent: string | null
  expiresAt: string | null
  duplicate: boolean
}>> {
  if (!dashboardOwnerMatches(context, input.restaurantId)) return err('Billing owner context required')
  if (!validOperationInput(input)
    || !/^[a-f0-9]{64}$/.test(input.callbackStateHash)
    || input.callbackUrl.length > 2_000) {
    return err('Billing card update input is invalid')
  }
  try {
    const callbackUrl = new URL(input.callbackUrl)
    if (callbackUrl.protocol !== 'https:'
      && !(callbackUrl.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(callbackUrl.hostname))) {
      return err('Billing card update callback is invalid')
    }
  } catch {
    return err('Billing card update callback is invalid')
  }

  const prepared = await port.prepareCardUpdate(input)
  if (!prepared.ok) return prepared
  if (!prepared.value.dispatchable) {
    if (prepared.value.status === 'succeeded') {
      return ok({
        operationId: prepared.value.operationId,
        providerCheckoutRef: prepared.value.providerCheckoutRef,
        checkoutContent: null,
        expiresAt: prepared.value.expiresAt,
        duplicate: true,
      })
    }
    return err('Billing card update operation is already in progress')
  }

  const initialized = await provider.initializeSubscriptionCardUpdate({
    providerSubscriptionRef: prepared.value.providerSubscriptionRef,
    callbackUrl: input.callbackUrl,
    idempotencyKey: input.idempotencyKey,
  })
  if (!initialized.ok) {
    const marked = await port.markOperationForReconciliation({
      operationId: prepared.value.operationId,
      reason: initialized.error,
    })
    return marked.ok ? initialized : err('Billing card update failed and reconciliation tracking failed')
  }
  const persisted = await port.markCardUpdateInitialized({
    operationId: prepared.value.operationId,
    providerCheckoutRef: initialized.value.providerCheckoutRef,
    expiresAt: initialized.value.expiresAt,
  })
  if (!persisted.ok) {
    const marked = await port.markOperationForReconciliation({
      operationId: prepared.value.operationId,
      reason: persisted.error,
    })
    return marked.ok
      ? err('Billing card update requires reconciliation')
      : err('Billing card update initialization and reconciliation tracking failed')
  }
  return ok({
    operationId: prepared.value.operationId,
    providerCheckoutRef: initialized.value.providerCheckoutRef,
    checkoutContent: initialized.value.checkoutContent,
    expiresAt: initialized.value.expiresAt,
    duplicate: false,
  })
}

/** The official hosted flow posts its initialized token only after successful
 * card validation/update. A second random callback state binds that token to
 * the exact local operation without creating payment or entitlement evidence. */
export async function completeSubscriptionCardUpdate(
  input: {
    providerCheckoutRef: string
    callbackState: string
    occurredAt?: string
  },
  port: SubscriptionCardUpdatePort,
): Promise<Result<{
  operationId: string
  restaurantId: string
  subscriptionId: string
  outcome: 'succeeded' | 'ambiguous'
  duplicate: boolean
}>> {
  const occurredAt = input.occurredAt ?? new Date().toISOString()
  if (!/^[\x21-\x7e]{1,200}$/.test(input.providerCheckoutRef)
    || !/^[A-Za-z0-9_-]{32,200}$/.test(input.callbackState)
    || !validTimestamp(occurredAt)) {
    return err('Billing card update callback input is invalid')
  }
  return port.completeCardUpdate({
    providerCheckoutRef: input.providerCheckoutRef,
    callbackState: input.callbackState,
    occurredAt,
  })
}
