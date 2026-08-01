import type {
  BillingCancellationPreparation,
  BillingCheckoutPreparation,
  BillingProviderOperationStatus,
  BillingRetryPreparation,
  SubscriptionBillingAddress,
  SubscriptionBillingOperationsPort,
  SubscriptionBillingProfile,
} from '@garsonless/application/billing'
import { err, ok, type Result } from '@garsonless/domain/result'
import { createServiceClient } from './client'

export type SubscriptionBillingOperationsRpc = (
  name: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message: string } | null }>

function serviceRpc(): SubscriptionBillingOperationsRpc {
  const service = createServiceClient()
  return service.rpc.bind(service) as unknown as SubscriptionBillingOperationsRpc
}

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function nullableText(value: unknown): string | null | undefined {
  return value === null ? null : text(value) ?? undefined
}

function operationStatus(value: unknown): BillingProviderOperationStatus | null {
  return ['processing', 'awaiting_callback', 'succeeded', 'requires_reconciliation'].includes(value as string)
    ? value as BillingProviderOperationStatus
    : null
}

function address(value: unknown): SubscriptionBillingAddress | null {
  const row = object(value)
  const contactName = text(row?.contactName)
  const city = text(row?.city)
  const country = text(row?.country)
  const line = text(row?.address)
  const district = nullableText(row?.district ?? null)
  const zipCode = nullableText(row?.zipCode ?? null)
  return row && contactName && city && country && line
    && district !== undefined && zipCode !== undefined
    ? { contactName, city, country, address: line, district, zipCode }
    : null
}

function profile(value: unknown): SubscriptionBillingProfile | null {
  const row = object(value)
  const billingAddress = address(row?.billingAddress)
  const shippingAddress = address(row?.shippingAddress)
  const legalName = text(row?.legalName)
  const name = text(row?.name)
  const surname = text(row?.surname)
  const identityNumber = text(row?.identityNumber)
  const email = text(row?.email)
  const gsmNumber = text(row?.gsmNumber)
  return row && billingAddress && shippingAddress && legalName && name && surname
    && identityNumber && email && gsmNumber
    ? { legalName, name, surname, identityNumber, email, gsmNumber, billingAddress, shippingAddress }
    : null
}

function checkoutPreparation(value: unknown): Result<BillingCheckoutPreparation> {
  const row = object(value)
  const operationId = text(row?.operationId)
  const customerId = text(row?.customerId)
  const invoiceId = text(row?.invoiceId)
  const parsedProfile = profile(row?.profile)
  const status = operationStatus(row?.status)
  const providerCheckoutRef = nullableText(row?.providerCheckoutRef)
  const plan = row?.plan
  const amountMinor = row?.amountMinor
  if (!row || !operationId || !customerId || !invoiceId || !parsedProfile || !status
    || providerCheckoutRef === undefined
    || !['starter', 'pro', 'enterprise'].includes(plan as string)
    || typeof amountMinor !== 'number' || !Number.isSafeInteger(amountMinor) || amountMinor <= 0
    || row.currency !== 'TRY' || typeof row.dispatchable !== 'boolean'
    || typeof row.duplicate !== 'boolean') {
    return err('Billing checkout preparation result is invalid')
  }
  return ok({
    operationId, customerId, invoiceId, profile: parsedProfile,
    plan: plan as BillingCheckoutPreparation['plan'],
    amount: { minor: amountMinor, currency: 'TRY' },
    status, providerCheckoutRef,
    dispatchable: row.dispatchable, duplicate: row.duplicate,
  })
}

function claimed(value: unknown, type: 'retry' | 'cancel'): Result<BillingRetryPreparation | BillingCancellationPreparation> {
  const row = object(value)
  const operationId = text(row?.operationId)
  const status = operationStatus(row?.status)
  const providerRef = text(row?.providerRef)
  if (!row || !operationId || !status || !providerRef
    || typeof row.dispatchable !== 'boolean' || typeof row.duplicate !== 'boolean') {
    return err('Billing provider operation claim result is invalid')
  }
  if (type === 'retry') {
    const invoiceId = text(row.invoiceId)
    return invoiceId ? ok({
      operationId, invoiceId, providerPaymentRef: providerRef, status,
      dispatchable: row.dispatchable, duplicate: row.duplicate,
    }) : err('Billing retry claim result is invalid')
  }
  const subscriptionId = text(row.subscriptionId)
  return subscriptionId ? ok({
    operationId, subscriptionId, providerSubscriptionRef: providerRef, status,
    dispatchable: row.dispatchable, duplicate: row.duplicate,
  }) : err('Billing cancellation claim result is invalid')
}

function profileArgs(restaurantId: string, value: SubscriptionBillingProfile): Record<string, unknown> {
  return {
    p_restaurant_id: restaurantId,
    p_legal_name: value.legalName,
    p_contact_name: value.name,
    p_contact_surname: value.surname,
    p_identity_number: value.identityNumber,
    p_contact_email: value.email,
    p_gsm_number: value.gsmNumber.replace(/[\s()-]/g, ''),
    p_billing_address: value.billingAddress,
    p_shipping_address: value.shippingAddress,
  }
}

export function createSubscriptionBillingOperationsPort(
  rpc: SubscriptionBillingOperationsRpc = serviceRpc(),
): SubscriptionBillingOperationsPort {
  const call = async (name: string, args: Record<string, unknown>) => {
    const { data, error } = await rpc(name, args)
    return error ? err(error.message) : ok(data)
  }
  return {
    async saveProfile(input) {
      const result = await call('upsert_subscription_billing_profile', profileArgs(input.restaurantId, input.profile))
      if (!result.ok) return result
      const customerId = text(object(result.value)?.customerId)
      return customerId ? ok({ customerId }) : err('Billing profile result is invalid')
    },
    async prepareCheckout(input) {
      const result = await call('prepare_subscription_checkout_operation', {
        ...profileArgs(input.restaurantId, input.profile),
        p_plan: input.plan,
        p_amount_minor: input.amount.minor,
        p_period_start: input.periodStart,
        p_period_end: input.periodEnd,
        p_due_at: input.dueAt,
        p_idempotency_key: input.idempotencyKey,
        p_request_fingerprint: input.requestFingerprint,
      })
      return result.ok ? checkoutPreparation(result.value) : result
    },
    async markCheckoutInitialized(input) {
      const result = await call('mark_subscription_checkout_initialized', {
        p_operation_id: input.operationId,
        p_provider_checkout_ref: input.providerCheckoutRef,
      })
      return result.ok && result.value === true ? ok(true) : result.ok ? err('Billing checkout mark result is invalid') : result
    },
    async bindCheckoutProviderPlan(input) {
      const result = await call('bind_subscription_checkout_provider_plan', {
        p_operation_id: input.operationId,
        p_expected_provider_plan_ref: input.expectedProviderPlanRef,
      })
      return result.ok && result.value === true
        ? ok(true)
        : result.ok ? err('Billing checkout plan binding result is invalid') : result
    },
    async findCheckoutCallback(providerCheckoutRef) {
      const result = await call('find_subscription_checkout_callback', { p_provider_checkout_ref: providerCheckoutRef })
      if (!result.ok) return result
      const row = object(result.value)
      const operationId = text(row?.operationId)
      const restaurantId = text(row?.restaurantId)
      const invoiceId = text(row?.invoiceId)
      const requestedPlan = text(row?.requestedPlan)
      const expectedProviderPlanRef = text(row?.expectedProviderPlanRef)
      return operationId && restaurantId && invoiceId
        && (requestedPlan === 'starter' || requestedPlan === 'pro' || requestedPlan === 'enterprise')
        && expectedProviderPlanRef && /^[\x21-\x7e]{1,200}$/.test(expectedProviderPlanRef)
        ? ok({ operationId, restaurantId, invoiceId, requestedPlan, expectedProviderPlanRef })
        : err('Billing checkout callback result is invalid')
    },
    async finalizeCheckout(input) {
      const result = await call('finalize_subscription_checkout_operation', {
        p_operation_id: input.operationId,
        p_provider_customer_ref: input.providerCustomerRef,
        p_provider_subscription_ref: input.providerSubscriptionRef,
        p_provider_plan_ref: input.providerPlanRef,
        p_provider_invoice_ref: input.providerInvoiceRef,
        p_period_start: input.periodStart,
        p_period_end: input.periodEnd,
      })
      if (!result.ok) return result
      const row = object(result.value)
      const restaurantId = text(row?.restaurantId)
      const subscriptionId = text(row?.subscriptionId)
      const invoiceId = text(row?.invoiceId)
      return restaurantId && subscriptionId && invoiceId && typeof row?.duplicate === 'boolean'
        ? ok({ restaurantId, subscriptionId, invoiceId, duplicate: row.duplicate })
        : err('Billing checkout finalization result is invalid')
    },
    async prepareRetry(input) {
      const result = await call('claim_subscription_billing_operation', {
        p_restaurant_id: input.restaurantId,
        p_operation_type: 'payment.retry',
        p_invoice_id: input.invoiceId,
        p_idempotency_key: input.idempotencyKey,
        p_request_fingerprint: input.requestFingerprint,
      })
      return result.ok ? claimed(result.value, 'retry') as Result<BillingRetryPreparation> : result
    },
    async prepareCancellation(input) {
      const result = await call('claim_subscription_billing_operation', {
        p_restaurant_id: input.restaurantId,
        p_operation_type: 'subscription.cancel',
        p_invoice_id: null,
        p_idempotency_key: input.idempotencyKey,
        p_request_fingerprint: input.requestFingerprint,
      })
      return result.ok ? claimed(result.value, 'cancel') as Result<BillingCancellationPreparation> : result
    },
    async completeOperation(input) {
      const result = await call('complete_subscription_billing_operation', {
        p_operation_id: input.operationId,
        p_result_sanitized: input.result,
      })
      return result.ok && result.value === true ? ok(true) : result.ok ? err('Billing operation completion result is invalid') : result
    },
    async markOperationForReconciliation(input) {
      const result = await call('mark_subscription_billing_operation_reconciliation', {
        p_operation_id: input.operationId,
        p_reason: input.reason.slice(0, 1000),
      })
      return result.ok && result.value === true ? ok(true) : result.ok ? err('Billing reconciliation mark result is invalid') : result
    },
    async finalizeCancellation(input) {
      const result = await call('finalize_subscription_cancellation', {
        p_operation_id: input.operationId,
        p_cancelled_at: input.cancelledAt,
        p_actor_user_id: input.actorUserId,
        p_request_id: input.requestId,
      })
      if (!result.ok) return result
      const row = object(result.value)
      const subscriptionId = text(row?.subscriptionId)
      return subscriptionId && typeof row?.duplicate === 'boolean'
        ? ok({ subscriptionId, duplicate: row.duplicate })
        : err('Billing cancellation result is invalid')
    },
  }
}
