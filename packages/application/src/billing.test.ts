import assert from 'node:assert/strict'
import test from 'node:test'
import { ok, type Result } from '@garsonless/domain/result'
import {
  createSubscriptionInvoice,
  recordSubscriptionPaymentFailure,
  recordSubscriptionPaymentSuccess,
  verifySubscriptionBillingWebhook,
  type SubscriptionBillingPersistencePort,
  type SubscriptionBillingProvider,
  type VerifiedSubscriptionBillingEvent,
} from './billing'

function providerWith(event: VerifiedSubscriptionBillingEvent): SubscriptionBillingProvider {
  const unused = async (): Promise<Result<never>> => ({ ok: false, error: 'unused' })
  return {
    createCustomer: unused,
    createCheckout: unused,
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
