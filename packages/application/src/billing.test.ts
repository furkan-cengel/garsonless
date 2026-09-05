import assert from 'node:assert/strict'
import test from 'node:test'
import { ok, type Result } from '@garsonless/domain/result'
import {
  cancelTenantSubscription,
  completeSubscriptionCardUpdate,
  completeSubscriptionCheckout,
  createSubscriptionInvoice,
  processSubscriptionBillingWebhook,
  recordSubscriptionPaymentFailure,
  recordSubscriptionPaymentSuccess,
  readSubscriptionBillingSettings,
  retrySubscriptionInvoice,
  saveSubscriptionBillingProfile,
  scheduleTenantSubscriptionCancellation,
  scheduleSubscriptionPlanChange,
  startSubscriptionCardUpdate,
  startSubscriptionCheckout,
  verifySubscriptionBillingWebhook,
  withdrawTenantSubscriptionCancellation,
  type SubscriptionBillingOperationsPort,
  type SubscriptionBillingPersistencePort,
  type SubscriptionBillingProfile,
  type SubscriptionBillingProvider,
  type SubscriptionCardUpdatePort,
  type SubscriptionCancellationSchedulePort,
  type SubscriptionPlanChangePort,
  type SubscriptionBillingWebhookInboxPort,
  type SubscriptionBillingWebhookInboxResult,
  type VerifiedSubscriptionBillingEvent,
} from './billing'

function providerWith(event: VerifiedSubscriptionBillingEvent): SubscriptionBillingProvider {
  const unused = async (): Promise<Result<never>> => ({ ok: false, error: 'unused' })
  return {
    createCustomer: unused,
    createCheckout: unused,
    retrieveCheckout: unused,
    probeCheckout: unused,
    retryInvoice: unused,
    cancelSubscription: unused,
    verifyWebhook: async () => ok(event),
  }
}

const validEvent: VerifiedSubscriptionBillingEvent = {
  eventId: 'iyzi-event-1',
  type: 'invoice.payment_succeeded',
  occurredAt: '2026-07-22T10:00:00.000Z',
  providerCustomerRef: 'customer-1',
  providerSubscriptionRef: 'subscription-1',
  providerInvoiceRef: 'invoice-1',
  providerAttemptRef: 'attempt-1',
  amount: { minor: 14_990, currency: 'TRY' },
  sanitizedPayload: { status: 'success' },
  payloadHash: 'sha256:fixture',
}

test('billing webhook verification delegates signature parsing to the provider port', async () => {
  const result = await verifySubscriptionBillingWebhook(
    { rawBody: new TextEncoder().encode('{}'), headers: { 'x-signature': 'signed' } },
    providerWith(validEvent),
  )
  assert.deepEqual(result, ok(validEvent))
})

test('billing webhook verification rejects empty and structurally unusable events', async () => {
  const empty = await verifySubscriptionBillingWebhook(
    { rawBody: new Uint8Array(), headers: {} },
    providerWith(validEvent),
  )
  assert.deepEqual(empty, { ok: false, error: 'Webhook body is required' })

  const invalid = await verifySubscriptionBillingWebhook(
    { rawBody: new TextEncoder().encode('{}'), headers: {} },
    providerWith({ ...validEvent, eventId: ' ', payloadHash: '' }),
  )
  assert.deepEqual(invalid, { ok: false, error: 'Provider event id is required' })
})

function persistencePort(calls: string[]): SubscriptionBillingPersistencePort {
  return {
    createInvoice: async (input) => {
      calls.push(`invoice:${input.idempotencyKey}`)
      return ok({ invoiceId: 'invoice-1', status: 'open', duplicate: false })
    },
    recordPaymentFailure: async (input) => {
      calls.push(`failure:${input.idempotencyKey}`)
      return ok({
        invoiceId: input.invoiceId,
        attemptId: 'attempt-1',
        invoiceStatus: 'past_due',
        subscriptionStatus: 'past_due',
        duplicate: false,
        ignoredBecausePaid: false,
      })
    },
    recordPaymentSuccess: async (input) => {
      calls.push(`success:${input.idempotencyKey}`)
      return ok({
        invoiceId: input.invoiceId,
        attemptId: 'attempt-2',
        invoiceStatus: 'paid',
        subscriptionStatus: 'active',
        duplicate: false,
        reactivated: false,
      })
    },
  }
}

const platformContext = { actor: 'platform-billing', restaurantId: 'restaurant-1', provider: 'iyzico' } as const
const providerContext = { actor: 'payment-provider', restaurantId: 'restaurant-1', provider: 'iyzico' } as const
const baseAmount = { minor: 14_990, currency: 'TRY' } as const

test('invoice command validates trusted tenant context and delegates valid input', async () => {
  const calls: string[] = []
  const input = {
    restaurantId: 'restaurant-1',
    subscriptionId: 'subscription-1',
    plan: 'pro' as const,
    amount: baseAmount,
    periodStart: '2026-07-01T00:00:00.000Z',
    periodEnd: '2026-08-01T00:00:00.000Z',
    dueAt: '2026-07-01T00:00:00.000Z',
    idempotencyKey: 'invoice:2026-07',
  }
  assert.equal((await createSubscriptionInvoice(platformContext, input, persistencePort(calls))).ok, true)
  assert.deepEqual(calls, ['invoice:invoice:2026-07'])
  assert.deepEqual(
    await createSubscriptionInvoice({ ...platformContext, restaurantId: 'other' }, input, persistencePort([])),
    { ok: false, error: 'Billing context mismatch' },
  )
  assert.deepEqual(
    await createSubscriptionInvoice(platformContext, { ...input, periodEnd: input.periodStart }, persistencePort([])),
    { ok: false, error: 'Invoice period is invalid' },
  )
})

test('provider result commands reject cross-tenant and unsafe money before persistence', async () => {
  const failure = {
    restaurantId: 'restaurant-1', subscriptionId: 'subscription-1', invoiceId: 'invoice-1',
    providerEventId: 'event-1', providerAttemptRef: null, amount: baseAmount,
    failureCode: 'declined', failureMessage: 'Card declined',
    occurredAt: '2026-07-22T10:00:00.000Z', idempotencyKey: 'failure-1',
  }
  assert.deepEqual(
    await recordSubscriptionPaymentFailure({ ...providerContext, restaurantId: 'other' }, failure, persistencePort([])),
    { ok: false, error: 'Billing context mismatch' },
  )
  assert.deepEqual(
    await recordSubscriptionPaymentSuccess(providerContext, { ...failure, amount: { minor: 1.2, currency: 'TRY' } }, persistencePort([])),
    { ok: false, error: 'Billing amount is invalid' },
  )
})

test('provider failure and success commands delegate validated callback projections', async () => {
  const calls: string[] = []
  const common = {
    restaurantId: 'restaurant-1', subscriptionId: 'subscription-1', invoiceId: 'invoice-1',
    providerEventId: 'event-1', providerAttemptRef: 'provider-attempt-1', amount: baseAmount,
    occurredAt: '2026-07-22T10:00:00.000Z', idempotencyKey: 'attempt-1',
  }
  assert.equal((await recordSubscriptionPaymentFailure(providerContext, {
    ...common, failureCode: 'declined', failureMessage: 'Card declined',
  }, persistencePort(calls))).ok, true)
  assert.equal((await recordSubscriptionPaymentSuccess(providerContext, common, persistencePort(calls))).ok, true)
  assert.deepEqual(calls, ['failure:attempt-1', 'success:attempt-1'])
})

function inboxWith(
  overrides: Partial<SubscriptionBillingWebhookInboxResult> = {},
  failures: string[] = [],
): SubscriptionBillingWebhookInboxPort {
  return {
    ingest: async () => ok({
      providerEventId: 'event-row-1',
      restaurantId: 'restaurant-1',
      subscriptionId: 'subscription-1',
      invoiceId: 'invoice-1',
      amount: baseAmount,
      duplicate: false,
      dispatchable: true,
      alreadyProcessed: false,
      ...overrides,
    }),
    markFailed: async (input) => {
      failures.push(input.reason)
      return ok(true)
    },
  }
}

test('webhook orchestration uses the local invoice amount and dispatches a verified event once', async () => {
  const calls: string[] = []
  const result = await processSubscriptionBillingWebhook(
    { rawBody: new TextEncoder().encode('{}'), headers: {} },
    providerWith({ ...validEvent, amount: null }),
    inboxWith(),
    persistencePort(calls),
  )
  assert.deepEqual(result, ok({ providerEventId: 'event-row-1', outcome: 'processed' }))
  assert.deepEqual(calls, ['success:iyzico-webhook:iyzi-event-1'])
})

test('unmapped and already-processed provider events stop safely without a money transition', async () => {
  const calls: string[] = []
  const unmapped = await processSubscriptionBillingWebhook(
    { rawBody: new TextEncoder().encode('{}'), headers: {} }, providerWith(validEvent),
    inboxWith({ restaurantId: null, subscriptionId: null, invoiceId: null, amount: null, dispatchable: false }),
    persistencePort(calls),
  )
  assert.deepEqual(unmapped, ok({ providerEventId: 'event-row-1', outcome: 'queued_for_reconciliation' }))
  const duplicate = await processSubscriptionBillingWebhook(
    { rawBody: new TextEncoder().encode('{}'), headers: {} }, providerWith(validEvent),
    inboxWith({ duplicate: true, dispatchable: false, alreadyProcessed: true }),
    persistencePort(calls),
  )
  assert.deepEqual(duplicate, ok({ providerEventId: 'event-row-1', outcome: 'duplicate' }))
  assert.deepEqual(calls, [])
})

test('failed aggregate transition marks the durable inbox for retry/reconciliation', async () => {
  const failures: string[] = []
  const broken = persistencePort([])
  broken.recordPaymentSuccess = async () => ({ ok: false, error: 'billing_amount_mismatch' })
  const result = await processSubscriptionBillingWebhook(
    { rawBody: new TextEncoder().encode('{}'), headers: {} }, providerWith(validEvent),
    inboxWith({}, failures), broken,
  )
  assert.deepEqual(result, { ok: false, error: 'billing_amount_mismatch' })
  assert.deepEqual(failures, ['billing_amount_mismatch'])
})

const billingProfile: SubscriptionBillingProfile = {
  legalName: 'Masabu Test AŞ',
  taxOffice: 'Kartal',
  name: 'Masabu',
  surname: 'Test',
  identityNumber: '11111111111',
  email: 'owner@example.com',
  gsmNumber: '+905551112233',
  billingAddress: {
    contactName: 'Masabu Test', city: 'İstanbul', district: 'Kadıköy',
    country: 'Türkiye', address: 'Test Sokak No: 1', zipCode: '34710',
  },
  shippingAddress: {
    contactName: 'Masabu Test', city: 'İstanbul', district: 'Kadıköy',
    country: 'Türkiye', address: 'Test Sokak No: 1', zipCode: '34710',
  },
}

const billingOwner = {
  actor: 'dashboard-member', userId: 'owner-1', restaurantId: 'restaurant-1',
  permissions: ['settings'], isOwner: true,
} as const
const fingerprint = 'a'.repeat(64)

function operationsPort(calls: string[]): SubscriptionBillingOperationsPort & import('./billing').SubscriptionCheckoutRecoveryPort {
  return {
    saveProfile: async () => {
      calls.push('profile')
      return ok({ customerId: 'customer-1' })
    },
    prepareCheckout: async (input) => {
      calls.push('prepare-checkout')
      return ok({
        operationId: 'operation-checkout', customerId: 'customer-1',
        invoiceId: 'operation-checkout', profile: input.profile, plan: input.plan,
        interval: input.interval, amount: input.amount, dispatchable: true, duplicate: false,
        providerCheckoutRef: null, status: 'processing',
      })
    },
    markCheckoutInitialized: async () => {
      calls.push('mark-checkout')
      return ok(true)
    },
    bindCheckoutProviderPlan: async ({ expectedProviderPlanRef }) => {
      calls.push(`bind-plan:${expectedProviderPlanRef}`)
      return ok(true)
    },
    findCheckoutCallback: async () => {
      calls.push('find-checkout')
      return ok({
        operationId: 'operation-checkout', restaurantId: 'restaurant-1',
        invoiceId: 'operation-checkout', requestedPlan: 'pro',
        expectedProviderPlanRef: 'provider-plan-1',
        expectedAmount: baseAmount, expectedBillingInterval: 'monthly',
        expiresAt: '2099-07-22T10:30:00.000Z', attempts: 1,
      })
    },
    finalizeCheckout: async () => {
      calls.push('finalize-checkout')
      return ok({
        restaurantId: 'restaurant-1', subscriptionId: 'subscription-1', invoiceId: 'invoice-1',
        invoiceStatus: 'paid', paymentEvidence: 'authenticated_retrieve', duplicate: false,
      })
    },
    prepareRetry: async (input) => {
      calls.push('prepare-retry')
      return ok({
        operationId: 'operation-retry', invoiceId: input.invoiceId,
        providerPaymentRef: 'provider-order-1', dispatchable: true,
        duplicate: false, status: 'processing',
      })
    },
    prepareCancellation: async () => {
      calls.push('prepare-cancel')
      return ok({
        operationId: 'operation-cancel', subscriptionId: 'subscription-1',
        providerSubscriptionRef: 'provider-subscription-1', dispatchable: true,
        duplicate: false, status: 'processing',
      })
    },
    completeOperation: async ({ operationId }) => {
      calls.push(`complete:${operationId}`)
      return ok(true)
    },
    markOperationForReconciliation: async ({ operationId }) => {
      calls.push(`reconcile:${operationId}`)
      return ok(true)
    },
    finalizeCancellation: async ({ cancelledAt }) => {
      calls.push(`finalize-cancel:${cancelledAt}`)
      return ok({ subscriptionId: 'subscription-1', duplicate: false })
    },
    claimCheckoutRecoveryOperation: async () => ok({
      operationId: 'operation-checkout', restaurantId: 'restaurant-1',
      providerCheckoutRef: 'checkout-token', expectedProviderPlanRef: 'provider-plan-1',
      expectedAmount: baseAmount, expectedBillingInterval: 'monthly',
      expiresAt: '2099-07-22T10:30:00.000Z', attempts: 1,
    }),
    rescheduleCheckoutRecovery: async () => ok(true),
    expireCheckoutRecovery: async () => ok(true),
  }
}

function capabilityProvider(calls: string[]): SubscriptionBillingProvider {
  const provider = providerWith(validEvent)
  provider.createCheckout = async () => {
    calls.push('provider-checkout')
    return ok({
      providerCheckoutRef: 'checkout-token', providerPlanRef: 'provider-plan-1',
      checkoutContent: '<form>hosted</form>', expiresAt: null,
    })
  }
  provider.retrieveCheckout = async ({ expectedProviderPlanRef }) => {
    calls.push(`provider-retrieve:${expectedProviderPlanRef}`)
    return ok({
      providerCustomerRef: 'provider-customer-1',
      providerSubscriptionRef: 'provider-subscription-1',
      providerPlanRef: 'provider-plan-1', providerInvoiceRef: 'provider-order-1',
      providerPaymentId: 'provider-payment-1',
      providerOrderStatus: 'succeeded', amount: baseAmount,
      periodStart: '2026-07-22T10:00:00.000Z', periodEnd: '2026-08-22T10:00:00.000Z',
      status: 'active',
    })
  }
  provider.probeCheckout = async ({ expectedProviderPlanRef }) => {
    calls.push(`provider-probe:${expectedProviderPlanRef}`)
    return ok({
      outcome: 'active',
      checkout: {
        providerCustomerRef: 'provider-customer-1',
        providerSubscriptionRef: 'provider-subscription-1',
        providerPlanRef: 'provider-plan-1', providerInvoiceRef: 'provider-order-1',
        providerPaymentId: 'provider-payment-1',
        providerOrderStatus: 'succeeded', amount: baseAmount,
        periodStart: '2026-07-22T10:00:00.000Z', periodEnd: '2026-08-22T10:00:00.000Z',
        status: 'active',
      },
    })
  }
  provider.retryInvoice = async ({ providerPaymentRef }) => {
    calls.push(`provider-retry:${providerPaymentRef}`)
    return ok({ accepted: true })
  }
  provider.cancelSubscription = async ({ providerSubscriptionRef }) => {
    calls.push(`provider-cancel:${providerSubscriptionRef}`)
    return ok({ cancelledAt: '2026-07-22T12:00:00.000Z' })
  }
  return provider
}

test('owner-only billing profile and checkout reject unauthorized contexts before persistence', async () => {
  const calls: string[] = []
  const member = { ...billingOwner, isOwner: false }
  assert.deepEqual(await saveSubscriptionBillingProfile(member, {
    restaurantId: 'restaurant-1', profile: billingProfile,
  }, operationsPort(calls)), { ok: false, error: 'Billing owner context required' })
  assert.deepEqual(await startSubscriptionCheckout(member, {
    restaurantId: 'restaurant-1', profile: billingProfile, plan: 'pro', interval: 'monthly', amount: baseAmount,
    periodStart: '2026-07-22T10:00:00.000Z', periodEnd: '2026-08-22T10:00:00.000Z',
    dueAt: '2026-07-22T10:00:00.000Z', callbackUrl: 'https://app.masabu.co/api/billing/callback',
    expectedProviderPlanRef: 'provider-plan-1',
    idempotencyKey: 'checkout-1', requestFingerprint: fingerprint,
  }, operationsPort(calls), capabilityProvider(calls)), {
    ok: false, error: 'Billing owner context required',
  })
  assert.deepEqual(calls, [])
})

test('checkout is claimed before one hosted provider dispatch and duplicate claims do not dispatch', async () => {
  const calls: string[] = []
  const port = operationsPort(calls)
  const provider = capabilityProvider(calls)
  const input = {
    restaurantId: 'restaurant-1', profile: billingProfile, plan: 'pro' as const, interval: 'monthly' as const, amount: baseAmount,
    periodStart: '2026-07-22T10:00:00.000Z', periodEnd: '2026-08-22T10:00:00.000Z',
    dueAt: '2026-07-22T10:00:00.000Z', callbackUrl: 'https://app.masabu.co/api/billing/callback',
    expectedProviderPlanRef: 'provider-plan-1',
    idempotencyKey: 'checkout-1', requestFingerprint: fingerprint,
  }
  assert.equal((await startSubscriptionCheckout(billingOwner, input, port, provider)).ok, true)
  assert.deepEqual(calls, [
    'prepare-checkout', 'bind-plan:provider-plan-1', 'provider-checkout', 'mark-checkout',
  ])

  calls.length = 0
  port.prepareCheckout = async (value) => ok({
    operationId: 'operation-checkout', customerId: 'customer-1', invoiceId: 'operation-checkout',
    profile: value.profile, plan: value.plan, interval: value.interval, amount: value.amount,
    dispatchable: false, duplicate: true, providerCheckoutRef: 'checkout-token', status: 'awaiting_callback',
  })
  assert.deepEqual(await startSubscriptionCheckout(billingOwner, input, port, provider), ok({
    operationId: 'operation-checkout', providerCheckoutRef: 'checkout-token',
    checkoutContent: null, expiresAt: null, duplicate: true,
  }))
  assert.deepEqual(calls, [])
})

test('checkout callback maps the provider order and quarantines non-active results', async () => {
  const calls: string[] = []
  const port = operationsPort(calls)
  const provider = capabilityProvider(calls)
  assert.equal((await completeSubscriptionCheckout({
    providerCheckoutRef: 'checkout-token', idempotencyKey: 'callback-1',
  }, port, provider)).ok, true)
  assert.deepEqual(calls, ['find-checkout', 'provider-probe:provider-plan-1', 'finalize-checkout'])

  calls.length = 0
  provider.probeCheckout = async () => ok({ outcome: 'incomplete' })
  assert.deepEqual(await completeSubscriptionCheckout({
    providerCheckoutRef: 'checkout-token', idempotencyKey: 'callback-2',
  }, port, provider), ok({ outcome: 'incomplete' }))
  assert.deepEqual(calls, ['find-checkout'])
})

test('checkout never dispatches before durable plan binding and quarantines provider drift', async () => {
  const calls: string[] = []
  const port = operationsPort(calls)
  const provider = capabilityProvider(calls)
  const input = {
    restaurantId: 'restaurant-1', profile: billingProfile, plan: 'pro' as const, interval: 'monthly' as const, amount: baseAmount,
    periodStart: '2026-07-22T10:00:00.000Z', periodEnd: '2026-08-22T10:00:00.000Z',
    dueAt: '2026-07-22T10:00:00.000Z', callbackUrl: 'https://app.masabu.co/api/billing/callback',
    expectedProviderPlanRef: 'provider-plan-1',
    idempotencyKey: 'checkout-1', requestFingerprint: fingerprint,
  }

  port.bindCheckoutProviderPlan = async () => ({ ok: false, error: 'binding unavailable' })
  assert.deepEqual(await startSubscriptionCheckout(billingOwner, input, port, provider), {
    ok: false, error: 'Billing checkout provider plan binding requires reconciliation',
  })
  assert.deepEqual(calls, ['prepare-checkout', 'reconcile:operation-checkout'])

  calls.length = 0
  port.bindCheckoutProviderPlan = async ({ expectedProviderPlanRef }) => {
    calls.push(`bind-plan:${expectedProviderPlanRef}`)
    return ok(true)
  }
  provider.createCheckout = async () => {
    calls.push('provider-checkout')
    return ok({
      providerCheckoutRef: 'checkout-token', providerPlanRef: 'provider-plan-enterprise',
      checkoutContent: '<form>hosted</form>', expiresAt: null,
    })
  }
  assert.deepEqual(await startSubscriptionCheckout(billingOwner, input, port, provider), {
    ok: false, error: 'Billing checkout provider plan mismatch',
  })
  assert.deepEqual(calls, [
    'prepare-checkout', 'bind-plan:provider-plan-1', 'provider-checkout',
    'reconcile:operation-checkout',
  ])
})

test('retry and immediate cancellation use claimed references and complete the durable operation', async () => {
  const calls: string[] = []
  const port = operationsPort(calls)
  const provider = capabilityProvider(calls)
  assert.deepEqual(await retrySubscriptionInvoice(billingOwner, {
    restaurantId: 'restaurant-1', invoiceId: 'invoice-1',
    idempotencyKey: 'retry-1', requestFingerprint: fingerprint,
  }, port, provider), ok({ accepted: true, duplicate: false }))
  assert.deepEqual(calls, [
    'prepare-retry', 'provider-retry:provider-order-1', 'complete:operation-retry',
  ])

  calls.length = 0
  assert.deepEqual(await cancelTenantSubscription(billingOwner, {
    restaurantId: 'restaurant-1', idempotencyKey: 'cancel-1', requestFingerprint: fingerprint,
  }, port, provider), ok({ subscriptionId: 'subscription-1', duplicate: false }))
  assert.deepEqual(calls, [
    'prepare-cancel', 'provider-cancel:provider-subscription-1',
    'complete:operation-cancel', 'finalize-cancel:2026-07-22T12:00:00.000Z',
  ])
})

test('owner period-end cancellation is scheduled locally and can be withdrawn before dispatch', async () => {
  const calls: string[] = []
  const port: SubscriptionCancellationSchedulePort = {
    async scheduleCancellation(input) {
      calls.push(`schedule:${input.requestedBy}:${input.occurredAt}`)
      return ok({
        cancellationRequestId: 'cancel-request-1',
        subscriptionId: 'subscription-1',
        status: 'scheduled',
        effectiveAt: '2026-10-01T00:00:00.000Z',
        duplicate: false,
      })
    },
    async withdrawCancellation(input) {
      calls.push(`withdraw:${input.cancellationRequestId}:${input.withdrawnBy}:${input.occurredAt}`)
      return ok({
        cancellationRequestId: input.cancellationRequestId,
        subscriptionId: 'subscription-1',
        status: 'withdrawn',
        duplicate: false,
      })
    },
  }
  assert.deepEqual(await scheduleTenantSubscriptionCancellation(billingOwner, {
    restaurantId: 'restaurant-1', idempotencyKey: 'schedule-cancel-1',
    requestFingerprint: fingerprint, occurredAt: '2026-09-01T00:00:00.000Z',
  }, port), ok({
    cancellationRequestId: 'cancel-request-1', subscriptionId: 'subscription-1',
    status: 'scheduled', effectiveAt: '2026-10-01T00:00:00.000Z', duplicate: false,
  }))
  assert.deepEqual(await withdrawTenantSubscriptionCancellation(billingOwner, {
    restaurantId: 'restaurant-1', cancellationRequestId: 'cancel-request-1',
    idempotencyKey: 'withdraw-cancel-1', requestFingerprint: fingerprint,
    occurredAt: '2026-09-02T00:00:00.000Z',
  }, port), ok({
    cancellationRequestId: 'cancel-request-1', subscriptionId: 'subscription-1',
    status: 'withdrawn', duplicate: false,
  }))
  assert.deepEqual(calls, [
    'schedule:owner-1:2026-09-01T00:00:00.000Z',
    'withdraw:cancel-request-1:owner-1:2026-09-02T00:00:00.000Z',
  ])
})

test('period-end cancellation keeps owner and immutable request validation at the application boundary', async () => {
  let called = false
  const port: SubscriptionCancellationSchedulePort = {
    async scheduleCancellation() { called = true; throw new Error('must not run') },
    async withdrawCancellation() { called = true; throw new Error('must not run') },
  }
  assert.deepEqual(await scheduleTenantSubscriptionCancellation(
    { ...billingOwner, isOwner: false },
    { restaurantId: 'restaurant-1', idempotencyKey: 'key', requestFingerprint: fingerprint },
    port,
  ), { ok: false, error: 'Billing owner context required' })
  assert.deepEqual(await withdrawTenantSubscriptionCancellation(billingOwner, {
    restaurantId: 'restaurant-1', cancellationRequestId: ' ',
    idempotencyKey: 'key', requestFingerprint: fingerprint,
  }, port), { ok: false, error: 'Billing cancellation withdrawal input is invalid' })
  assert.equal(called, false)
})

test('provider success followed by a local completion failure is never reported as a clean success', async () => {
  const calls: string[] = []
  const port = operationsPort(calls)
  port.completeOperation = async () => ({ ok: false, error: 'rpc unavailable' })
  const result = await retrySubscriptionInvoice(billingOwner, {
    restaurantId: 'restaurant-1', invoiceId: 'invoice-1',
    idempotencyKey: 'retry-1', requestFingerprint: fingerprint,
  }, port, capabilityProvider(calls))
  assert.deepEqual(result, { ok: false, error: 'Billing retry requires reconciliation' })
  assert.deepEqual(calls, [
    'prepare-retry', 'provider-retry:provider-order-1', 'reconcile:operation-retry',
  ])
})

test('plan change stays scheduled until renewal evidence and provider/local failures reconcile', async () => {
  const calls: string[] = []
  const port: SubscriptionPlanChangePort & Pick<SubscriptionBillingOperationsPort, 'markOperationForReconciliation'> = {
    async preparePlanChange() {
      calls.push('prepare-change')
      return ok({
        changeRequestId: 'change-1', operationId: 'operation-change-1',
        subscriptionId: 'subscription-1', providerSubscriptionRef: 'provider-parent',
        providerTargetPlanRef: 'provider-plan-pro', fromPlan: 'plus' as const, toPlan: 'pro' as const,
        billingInterval: 'monthly' as const, effectivePolicy: 'next_period' as const,
        effectiveAt: '2026-10-01T00:00:00.000Z', status: 'processing' as const,
        dispatchable: true, duplicate: false,
      })
    },
    async finalizePlanChange(input: { result: { providerTargetSubscriptionRef: string } }) {
      calls.push(`finalize-change:${input.result.providerTargetSubscriptionRef}`)
      return ok({
        changeRequestId: 'change-1', subscriptionId: 'subscription-1',
        status: 'scheduled' as const, effectiveAt: '2026-10-01T00:00:00.000Z', duplicate: false,
      })
    },
    async markOperationForReconciliation(input: { operationId: string }) {
      calls.push(`reconcile:${input.operationId}`)
      return ok(true as const)
    },
  }
  const provider = {
    async upgradeSubscription() {
      calls.push('provider-upgrade-next-period')
      return ok({
        providerParentSubscriptionRef: 'provider-parent',
        providerTargetSubscriptionRef: 'provider-child',
        providerTargetPlanRef: 'provider-plan-pro', providerStatus: 'active' as const,
        providerPeriodStart: '2026-10-01T00:00:00.000Z',
        providerPeriodEnd: '2027-10-01T00:00:00.000Z',
      })
    },
  }
  const result = await scheduleSubscriptionPlanChange(billingOwner, {
    restaurantId: 'restaurant-1', toPlan: 'pro', toBillingInterval: 'monthly',
    providerTargetPlanRef: 'provider-plan-pro', effectivePolicy: 'next_period',
    idempotencyKey: 'plan-change-1', requestFingerprint: fingerprint,
    occurredAt: '2026-09-01T12:00:00.000Z',
  }, port, provider)
  assert.deepEqual(result, ok({
    changeRequestId: 'change-1', subscriptionId: 'subscription-1',
    status: 'scheduled', effectiveAt: '2026-10-01T00:00:00.000Z', duplicate: false,
  }))
  assert.deepEqual(calls, [
    'prepare-change', 'provider-upgrade-next-period', 'finalize-change:provider-child',
  ])

  port.finalizePlanChange = async () => ({ ok: false, error: 'db unavailable' })
  calls.length = 0
  const ambiguous = await scheduleSubscriptionPlanChange(billingOwner, {
    restaurantId: 'restaurant-1', toPlan: 'pro', toBillingInterval: 'monthly',
    providerTargetPlanRef: 'provider-plan-pro', effectivePolicy: 'next_period',
    idempotencyKey: 'plan-change-2', requestFingerprint: fingerprint,
  }, port, provider)
  assert.deepEqual(ambiguous, { ok: false, error: 'Billing plan change requires reconciliation' })
  assert.ok(calls.includes('reconcile:operation-change-1'))
})

test('billing settings projection is owner-only and tenant-scoped before the read port', async () => {
  const calls: string[] = []
  const port = {
    async readSettings({ restaurantId }: { restaurantId: string }) {
      calls.push(restaurantId)
      return ok({
        profile: null,
        subscription: null,
        invoices: [],
        refunds: [],
        attention: { reconciliationCount: 0, hasPendingCheckout: false, nextDunningActionAt: null },
      })
    },
  }
  assert.deepEqual(await readSubscriptionBillingSettings(
    { ...billingOwner, isOwner: false }, 'restaurant-1', port,
  ), { ok: false, error: 'Billing owner context required' })
  assert.deepEqual(await readSubscriptionBillingSettings(
    billingOwner, 'restaurant-other', port,
  ), { ok: false, error: 'Billing owner context required' })
  assert.deepEqual(calls, [])

  const result = await readSubscriptionBillingSettings(billingOwner, 'restaurant-1', port)
  assert.equal(result.ok, true)
  assert.deepEqual(calls, ['restaurant-1'])
})

test('hosted card update separates durable initialization from exact callback completion', async () => {
  const calls: string[] = []
  const cardPort: SubscriptionCardUpdatePort & Pick<SubscriptionBillingOperationsPort, 'markOperationForReconciliation'> = {
    async prepareCardUpdate() {
      calls.push('prepare-card')
      return ok({
        operationId: 'card-operation-1', subscriptionId: 'subscription-1',
        providerSubscriptionRef: 'provider-subscription-1', status: 'processing' as const,
        providerCheckoutRef: null, expiresAt: null,
        dispatchable: true, duplicate: false,
      })
    },
    async markCardUpdateInitialized(input) {
      calls.push(`mark-card:${input.providerCheckoutRef}`)
      return ok(true as const)
    },
    async completeCardUpdate(input) {
      calls.push(`complete-card:${input.providerCheckoutRef}:${input.callbackState}`)
      return ok({
        operationId: 'card-operation-1', restaurantId: 'restaurant-1',
        subscriptionId: 'subscription-1', outcome: 'succeeded' as const, duplicate: false,
      })
    },
    async markOperationForReconciliation(input) {
      calls.push(`reconcile:${input.operationId}`)
      return ok(true as const)
    },
  }
  const provider = {
    async initializeSubscriptionCardUpdate(input: { providerSubscriptionRef: string }) {
      calls.push(`provider-card:${input.providerSubscriptionRef}`)
      return ok({
        providerCheckoutRef: 'card-token-1', checkoutContent: '<script></script>',
        expiresAt: '2026-09-01T12:30:00.000Z',
      })
    },
  }
  const started = await startSubscriptionCardUpdate(billingOwner, {
    restaurantId: 'restaurant-1',
    callbackUrl: 'https://app.masabu.co/api/billing/iyzico/card-update/callback?state=opaque',
    callbackStateHash: 'a'.repeat(64),
    idempotencyKey: 'card-update-1', requestFingerprint: fingerprint,
  }, cardPort, provider)
  assert.equal(started.ok && started.value.providerCheckoutRef, 'card-token-1')
  const completed = await completeSubscriptionCardUpdate({
    providerCheckoutRef: 'card-token-1', callbackState: 'a'.repeat(32),
    occurredAt: '2026-09-01T12:05:00.000Z',
  }, cardPort)
  assert.equal(completed.ok && completed.value.outcome, 'succeeded')
  assert.deepEqual(calls, [
    'prepare-card', 'provider-card:provider-subscription-1',
    'mark-card:card-token-1', `complete-card:card-token-1:${'a'.repeat(32)}`,
  ])
})
