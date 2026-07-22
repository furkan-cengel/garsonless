import assert from 'node:assert/strict'
import test from 'node:test'
import { createSubscriptionBillingPersistencePort, type SubscriptionBillingRpc } from './subscription-billing-port'

const baseInvoice = {
  restaurantId: 'restaurant-1', subscriptionId: 'subscription-1', plan: 'pro' as const,
  amount: { minor: 14_990, currency: 'TRY' as const },
  periodStart: '2026-07-01T00:00:00.000Z', periodEnd: '2026-08-01T00:00:00.000Z',
  dueAt: '2026-07-01T00:00:00.000Z', idempotencyKey: 'invoice-1',
}

test('billing DB port maps invoice input to the atomic RPC and validates its result', async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  const rpc: SubscriptionBillingRpc = async (name, args) => {
    calls.push({ name, args })
    return { data: { invoiceId: 'invoice-1', status: 'open', duplicate: false }, error: null }
  }
  const result = await createSubscriptionBillingPersistencePort(rpc).createInvoice(baseInvoice)
  assert.equal(result.ok, true)
  assert.equal(calls[0]?.name, 'create_subscription_invoice_atomic')
  assert.equal(calls[0]?.args.p_amount_minor, 14_990)

  const invalid = await createSubscriptionBillingPersistencePort(async () => ({ data: { id: 'wrong' }, error: null }))
    .createInvoice(baseInvoice)
  assert.deepEqual(invalid, { ok: false, error: 'Billing invoice RPC result is invalid' })
})

test('billing DB port fail-closes malformed payment results and preserves RPC errors', async () => {
  const common = {
    restaurantId: 'restaurant-1', subscriptionId: 'subscription-1', invoiceId: 'invoice-1',
    providerEventId: 'event-1', providerAttemptRef: null,
    amount: { minor: 14_990, currency: 'TRY' as const },
    occurredAt: '2026-07-22T10:00:00.000Z', idempotencyKey: 'attempt-1',
  }
  const invalid = createSubscriptionBillingPersistencePort(async () => ({ data: {}, error: null }))
  assert.equal((await invalid.recordPaymentFailure({ ...common, failureCode: null, failureMessage: null })).ok, false)
  assert.equal((await invalid.recordPaymentSuccess(common)).ok, false)

  const failed = createSubscriptionBillingPersistencePort(async () => ({ data: null, error: { message: 'amount mismatch' } }))
  assert.deepEqual(await failed.recordPaymentSuccess(common), { ok: false, error: 'amount mismatch' })
})

test('billing DB port accepts typed idempotent failure and reactivation projections', async () => {
  const values = [
    { invoiceId: 'invoice-1', attemptId: null, invoiceStatus: 'paid', subscriptionStatus: 'active', duplicate: false, ignoredBecausePaid: true },
    { invoiceId: 'invoice-1', attemptId: 'attempt-1', invoiceStatus: 'paid', subscriptionStatus: 'active', duplicate: false, reactivated: true },
  ]
  const rpc: SubscriptionBillingRpc = async () => ({ data: values.shift(), error: null })
  const port = createSubscriptionBillingPersistencePort(rpc)
  const common = {
    restaurantId: 'restaurant-1', subscriptionId: 'subscription-1', invoiceId: 'invoice-1',
    providerEventId: 'event-1', providerAttemptRef: null,
    amount: { minor: 14_990, currency: 'TRY' as const },
    occurredAt: '2026-07-22T10:00:00.000Z', idempotencyKey: 'attempt-1',
  }
  assert.equal((await port.recordPaymentFailure({ ...common, failureCode: null, failureMessage: null })).ok, true)
  assert.equal((await port.recordPaymentSuccess(common)).ok, true)
})
