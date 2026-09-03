import type {
  BillingCancellationPreparation,
  BillingCheckoutPreparation,
  BillingCheckoutRecoveryJob,
  BillingCardUpdatePreparation,
  BillingProviderOperationStatus,
  BillingPlanChangePreparation,
  BillingRetryPreparation,
  SubscriptionBillingAddress,
  SubscriptionBillingOperationsPort,
  SubscriptionCheckoutRecoveryPort,
  SubscriptionCardUpdatePort,
  SubscriptionPlanChangePort,
  SubscriptionBillingProfile,
} from '@garsonless/application/billing'
import { err, ok, type Result } from '@garsonless/domain/result'
import { isValidAddOnSelection } from '@garsonless/domain/entitlements'
import { createServiceClient } from './service-client'

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
  return ['processing', 'awaiting_callback', 'succeeded', 'requires_reconciliation', 'expired'].includes(value as string)
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
  const billingAddressRow = object(row?.billingAddress)
  const billingAddress = address(row?.billingAddress)
  const shippingAddress = address(row?.shippingAddress)
  const legalName = text(row?.legalName)
  const taxOffice = text(row?.taxOffice) ?? text(billingAddressRow?.taxOffice)
  const name = text(row?.name)
  const surname = text(row?.surname)
  const identityNumber = text(row?.identityNumber)
  const email = text(row?.email)
  const gsmNumber = text(row?.gsmNumber)
  return row && billingAddress && shippingAddress && legalName && taxOffice && name && surname
    && identityNumber && email && gsmNumber
    ? { legalName, taxOffice, name, surname, identityNumber, email, gsmNumber, billingAddress, shippingAddress }
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
  const addOns = row?.addOns ?? []
  const interval = row?.interval
  const amountMinor = row?.amountMinor
  if (!row || !operationId || !customerId || !invoiceId || !parsedProfile || !status
    || providerCheckoutRef === undefined
    || !['starter', 'plus', 'pro'].includes(plan as string)
    || !Array.isArray(addOns)
    || !isValidAddOnSelection(plan as BillingCheckoutPreparation['plan'], addOns)
    || !['monthly', 'annual'].includes(interval as string)
    || typeof amountMinor !== 'number' || !Number.isSafeInteger(amountMinor) || amountMinor <= 0
    || row.currency !== 'TRY' || typeof row.dispatchable !== 'boolean'
    || typeof row.duplicate !== 'boolean') {
    return err('Billing checkout preparation result is invalid')
  }
  return ok({
    operationId, customerId, invoiceId, profile: parsedProfile,
    plan: plan as BillingCheckoutPreparation['plan'],
    addOns: addOns as NonNullable<BillingCheckoutPreparation['addOns']>,
    interval: interval as BillingCheckoutPreparation['interval'],
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
    p_billing_address: { ...value.billingAddress, taxOffice: value.taxOffice },
    p_shipping_address: value.shippingAddress,
  }
}

function checkoutRecoveryJob(value: unknown): Result<BillingCheckoutRecoveryJob> {
  const row = object(value)
  const operationId = text(row?.operationId)
  const restaurantId = text(row?.restaurantId)
  const providerCheckoutRef = text(row?.providerCheckoutRef)
  const expectedProviderPlanRef = text(row?.expectedProviderPlanRef)
  const expectedAmountMinor = row?.expectedAmountMinor
  const expectedCurrency = row?.expectedCurrency
  const expectedBillingInterval = row?.expectedBillingInterval
  const expiresAt = text(row?.expiresAt)
  const attempts = row?.attempts
  return row && operationId && restaurantId && providerCheckoutRef && expectedProviderPlanRef
    && typeof expectedAmountMinor === 'number' && Number.isSafeInteger(expectedAmountMinor) && expectedAmountMinor > 0
    && expectedCurrency === 'TRY' && ['monthly', 'annual'].includes(expectedBillingInterval as string)
    && expiresAt && Number.isFinite(Date.parse(expiresAt))
    && typeof attempts === 'number' && Number.isInteger(attempts) && attempts >= 1
    ? ok({
      operationId, restaurantId, providerCheckoutRef, expectedProviderPlanRef,
      expectedAmount: { minor: expectedAmountMinor, currency: 'TRY' },
      expectedBillingInterval: expectedBillingInterval as BillingCheckoutRecoveryJob['expectedBillingInterval'],
      expiresAt, attempts,
    })
    : err('Billing checkout recovery result is invalid')
}

function planChangePreparation(value: unknown): Result<BillingPlanChangePreparation> {
  const row = object(value)
  const changeRequestId = text(row?.changeRequestId)
  const operationId = text(row?.operationId)
  const subscriptionId = text(row?.subscriptionId)
  const providerSubscriptionRef = text(row?.providerSubscriptionRef)
  const providerTargetPlanRef = text(row?.providerTargetPlanRef)
  const fromPlan = row?.fromPlan
  const toPlan = row?.toPlan
  const billingInterval = row?.billingInterval
  const effectiveAt = text(row?.effectiveAt)
  const status = row?.status
  if (!row || !changeRequestId || !operationId || !subscriptionId
    || !providerSubscriptionRef || !providerTargetPlanRef || !effectiveAt
    || !Number.isFinite(Date.parse(effectiveAt))
    || !['starter', 'plus', 'pro'].includes(fromPlan as string)
    || !['starter', 'plus', 'pro'].includes(toPlan as string)
    || !['monthly', 'annual'].includes(billingInterval as string)
    || row.effectivePolicy !== 'next_period'
    || !['processing', 'scheduled', 'requires_reconciliation'].includes(status as string)
    || typeof row.dispatchable !== 'boolean' || typeof row.duplicate !== 'boolean') {
    return err('Billing plan change preparation result is invalid')
  }
  return ok({
    changeRequestId, operationId, subscriptionId, providerSubscriptionRef, providerTargetPlanRef,
    fromPlan: fromPlan as BillingPlanChangePreparation['fromPlan'],
    toPlan: toPlan as BillingPlanChangePreparation['toPlan'],
    billingInterval: billingInterval as BillingPlanChangePreparation['billingInterval'],
    effectivePolicy: 'next_period', effectiveAt,
    status: status as BillingPlanChangePreparation['status'],
    dispatchable: row.dispatchable, duplicate: row.duplicate,
  })
}

function cardUpdatePreparation(value: unknown): Result<BillingCardUpdatePreparation> {
  const row = object(value)
  const operationId = text(row?.operationId)
  const subscriptionId = text(row?.subscriptionId)
  const providerSubscriptionRef = text(row?.providerSubscriptionRef)
  const status = operationStatus(row?.status)
  const providerCheckoutRef = nullableText(row?.providerCheckoutRef)
  const expiresAt = nullableText(row?.expiresAt)
  if (!row || !operationId || !subscriptionId || !providerSubscriptionRef || !status
    || providerCheckoutRef === undefined || expiresAt === undefined
    || (expiresAt !== null && !Number.isFinite(Date.parse(expiresAt)))
    || typeof row.dispatchable !== 'boolean' || typeof row.duplicate !== 'boolean') {
    return err('Billing card update preparation result is invalid')
  }
  return ok({
    operationId, subscriptionId, providerSubscriptionRef, status,
    providerCheckoutRef, expiresAt,
    dispatchable: row.dispatchable, duplicate: row.duplicate,
  })
}

export function createSubscriptionBillingOperationsPort(
  rpc: SubscriptionBillingOperationsRpc = serviceRpc(),
): SubscriptionBillingOperationsPort & SubscriptionCheckoutRecoveryPort
  & SubscriptionPlanChangePort & SubscriptionCardUpdatePort {
  const call = async (name: string, args: Record<string, unknown>) => {
    const { data, error } = await rpc(name, args)
    return error ? err(error.message) : ok(data)
  }
  return {
    async prepareCardUpdate(input) {
      const result = await call('prepare_subscription_card_update', {
        p_restaurant_id: input.restaurantId,
        p_idempotency_key: input.idempotencyKey,
        p_request_fingerprint: input.requestFingerprint,
        p_callback_state_hash: input.callbackStateHash,
      })
      return result.ok ? cardUpdatePreparation(result.value) : result
    },
    async markCardUpdateInitialized(input) {
      const result = await call('mark_subscription_card_update_initialized', {
        p_operation_id: input.operationId,
        p_provider_checkout_ref: input.providerCheckoutRef,
        p_provider_checkout_expires_at: input.expiresAt,
      })
      return result.ok && result.value === true
        ? ok(true)
        : result.ok ? err('Billing card update mark result is invalid') : result
    },
    async completeCardUpdate(input) {
      const result = await call('complete_subscription_card_update', {
        p_provider_checkout_ref: input.providerCheckoutRef,
        p_callback_state: input.callbackState,
        p_occurred_at: input.occurredAt,
      })
      if (!result.ok) return result
      const row = object(result.value)
      const operationId = text(row?.operationId)
      const restaurantId = text(row?.restaurantId)
      const subscriptionId = text(row?.subscriptionId)
      const outcome = row?.outcome
      return operationId && restaurantId && subscriptionId
        && ['succeeded', 'ambiguous'].includes(outcome as string)
        && typeof row?.duplicate === 'boolean'
        ? ok({
          operationId, restaurantId, subscriptionId,
          outcome: outcome as 'succeeded' | 'ambiguous',
          duplicate: row.duplicate,
        })
        : err('Billing card update completion result is invalid')
    },
    async preparePlanChange(input) {
      const result = await call('prepare_subscription_plan_change', {
        p_restaurant_id: input.restaurantId,
        p_to_plan: input.toPlan,
        p_to_add_ons: input.toAddOns,
        p_to_billing_interval: input.toBillingInterval,
        p_provider_target_plan_ref: input.providerTargetPlanRef,
        p_effective_policy: input.effectivePolicy,
        p_idempotency_key: input.idempotencyKey,
        p_request_fingerprint: input.requestFingerprint,
        p_requested_by: input.requestedBy,
      })
      return result.ok ? planChangePreparation(result.value) : result
    },
    async finalizePlanChange(input) {
      const provider = input.result
      const result = await call('finalize_subscription_plan_change', {
        p_operation_id: input.operationId,
        p_change_request_id: input.changeRequestId,
        p_provider_parent_subscription_ref: provider.providerParentSubscriptionRef,
        p_provider_target_subscription_ref: provider.providerTargetSubscriptionRef,
        p_provider_target_plan_ref: provider.providerTargetPlanRef,
        p_provider_status: provider.providerStatus,
        p_provider_period_start: provider.providerPeriodStart,
        p_provider_period_end: provider.providerPeriodEnd,
        p_occurred_at: input.occurredAt,
      })
      if (!result.ok) return result
      const row = object(result.value)
      const changeRequestId = text(row?.changeRequestId)
      const subscriptionId = text(row?.subscriptionId)
      const effectiveAt = text(row?.effectiveAt)
      return changeRequestId && subscriptionId && effectiveAt
        && Number.isFinite(Date.parse(effectiveAt))
        && row?.status === 'scheduled' && typeof row?.duplicate === 'boolean'
        ? ok({ changeRequestId, subscriptionId, status: 'scheduled', effectiveAt, duplicate: row.duplicate })
        : err('Billing plan change finalization result is invalid')
    },
    async saveProfile(input) {
      const result = await call('upsert_subscription_billing_profile', profileArgs(input.restaurantId, input.profile))
      if (!result.ok) return result
      const customerId = text(object(result.value)?.customerId)
      return customerId ? ok({ customerId }) : err('Billing profile result is invalid')
    },
    async prepareCheckout(input) {
      const addOns = input.addOns ?? []
      const baseArgs = {
        ...profileArgs(input.restaurantId, input.profile),
        p_plan: input.plan,
        p_billing_interval: input.interval,
        p_amount_minor: input.amount.minor,
        p_period_start: input.periodStart,
        p_period_end: input.periodEnd,
        p_due_at: input.dueAt,
        p_idempotency_key: input.idempotencyKey,
        p_request_fingerprint: input.requestFingerprint,
      }
      const result = addOns.length === 0
        ? await call('prepare_subscription_checkout_operation', baseArgs)
        : await call('prepare_subscription_checkout_with_add_ons_operation', {
          ...baseArgs,
          p_add_ons: addOns,
          p_expected_provider_plan_ref: input.expectedProviderPlanRef,
        })
      return result.ok ? checkoutPreparation(result.value) : result
    },
    async markCheckoutInitialized(input) {
      const result = await call('mark_subscription_checkout_initialized', {
        p_operation_id: input.operationId,
        p_provider_checkout_ref: input.providerCheckoutRef,
        p_provider_checkout_expires_at: input.expiresAt,
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
      const expectedAmountMinor = row?.expectedAmountMinor
      const expectedCurrency = row?.expectedCurrency
      const expectedBillingInterval = row?.expectedBillingInterval
      const expiresAt = text(row?.expiresAt)
      const attempts = row?.attempts
      return operationId && restaurantId && invoiceId
        && (requestedPlan === 'starter' || requestedPlan === 'plus' || requestedPlan === 'pro')
        && expectedProviderPlanRef && /^[\x21-\x7e]{1,200}$/.test(expectedProviderPlanRef)
        && typeof expectedAmountMinor === 'number' && Number.isSafeInteger(expectedAmountMinor) && expectedAmountMinor > 0
        && expectedCurrency === 'TRY' && ['monthly', 'annual'].includes(expectedBillingInterval as string)
        && expiresAt && Number.isFinite(Date.parse(expiresAt))
        && typeof attempts === 'number' && Number.isInteger(attempts) && attempts >= 1
        ? ok({
          operationId, restaurantId, invoiceId, requestedPlan, expectedProviderPlanRef,
          expectedAmount: { minor: expectedAmountMinor, currency: 'TRY' },
          expectedBillingInterval: expectedBillingInterval as BillingCheckoutRecoveryJob['expectedBillingInterval'],
          expiresAt, attempts,
        })
        : err('Billing checkout callback result is invalid')
    },
    async finalizeCheckout(input) {
      const result = await call('finalize_subscription_checkout_with_payment_identity', {
        p_operation_id: input.operationId,
        p_provider_customer_ref: input.providerCustomerRef,
        p_provider_subscription_ref: input.providerSubscriptionRef,
        p_provider_plan_ref: input.providerPlanRef,
        p_provider_invoice_ref: input.providerInvoiceRef,
        p_provider_payment_id: input.providerPaymentId,
        p_provider_order_status: input.providerOrderStatus,
        p_amount_minor: input.amount.minor,
        p_currency: input.amount.currency,
        p_period_start: input.periodStart,
        p_period_end: input.periodEnd,
      })
      if (!result.ok) return result
      const row = object(result.value)
      const restaurantId = text(row?.restaurantId)
      const subscriptionId = text(row?.subscriptionId)
      const invoiceId = text(row?.invoiceId)
      if (!(restaurantId && subscriptionId && invoiceId
        && row?.invoiceStatus === 'paid'
        && row?.paymentEvidence === 'authenticated_retrieve'
        && typeof row?.duplicate === 'boolean')) {
        return err('Billing checkout finalization result is invalid')
      }
      return ok({
          restaurantId, subscriptionId, invoiceId,
          invoiceStatus: 'paid', paymentEvidence: 'authenticated_retrieve',
          duplicate: row.duplicate,
        })
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
    async claimCheckoutRecoveryOperation(input) {
      const result = await call('claim_subscription_checkout_recovery_operation', {
        p_restaurant_id: input.restaurantId,
        p_operation_id: input.operationId,
        p_worker: input.workerId,
        p_lease_seconds: input.leaseSeconds,
      })
      return result.ok ? checkoutRecoveryJob(result.value) : result
    },
    async rescheduleCheckoutRecovery(input) {
      const result = await call('reschedule_subscription_checkout_recovery', {
        p_operation_id: input.operationId,
        p_worker: input.workerId,
        p_next_at: input.nextAt,
        p_reason: input.reason,
      })
      return result.ok && result.value === true
        ? ok(true)
        : result.ok ? err('Billing checkout recovery schedule result is invalid') : result
    },
    async expireCheckoutRecovery(input) {
      const result = await call('expire_subscription_checkout_recovery', {
        p_operation_id: input.operationId,
        p_worker: input.workerId,
      })
      return result.ok && result.value === true
        ? ok(true)
        : result.ok ? err('Billing checkout expiry result is invalid') : result
    },
  }
}
