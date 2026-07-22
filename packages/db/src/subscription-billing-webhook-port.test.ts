import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createSubscriptionBillingWebhookInboxPort,
  type SubscriptionBillingWebhookRpc,
} from './subscription-billing-webhook-port'

const event = {
  eventId: 'event-1',
  type: 'invoice.payment_succeeded' as const,
  occurredAt: '2026-07-22T12:00:00.000Z',
  providerCustomerRef: 'customer-1',
  providerSubscriptionRef: 'subscription-1',
  providerInvoiceRef: 'invoice-1',
  providerAttemptRef: 'invoice-1',
  amount: null,
  sanitizedPayload: { iyziEventType: 'subscription.order.success' },
  payloadHash: 'a'.repeat(64),
}

test('billing webhook inbox port maps a verified projection to the service RPC', async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  const rpc: SubscriptionBillingWebhookRpc = async (name, args) => {
    calls.push({ name, args })
    return {
      data: {
        providerEventId: 'event-row-1', restaurantId: 'restaurant-1',
        subscriptionId: 'subscription-row-1', invoiceId: 'invoice-row-1',
        amountMinor: 14_990, currency: 'TRY', duplicate: false,
        dispatchable: true, alreadyProcessed: false,
      },
      error: null,
    }
  }
  const result = await createSubscriptionBillingWebhookInboxPort(rpc).ingest(event)
  assert.equal(result.ok, true)
  assert.equal(calls[0]?.name, 'ingest_subscription_billing_provider_event')
  assert.equal(calls[0]?.args.p_provider_invoice_ref, 'invoice-1')
  assert.deepEqual(result.ok && result.value.amount, { minor: 14_990, currency: 'TRY' })
})

test('billing webhook inbox port accepts a durable unresolved projection without inventing money', async () => {
  const port = createSubscriptionBillingWebhookInboxPort(async () => ({
    data: {
      providerEventId: 'event-row-1', restaurantId: null, subscriptionId: null,
      invoiceId: null, amountMinor: null, currency: null, duplicate: false,
      dispatchable: false, alreadyProcessed: false,
    }, error: null,
  }))
  const result = await port.ingest(event)
  assert.equal(result.ok, true)
  assert.equal(result.ok && result.value.amount, null)
})

test('billing webhook inbox port fail-closes malformed RPC results and can mark dispatch failure', async () => {
  const invalid = createSubscriptionBillingWebhookInboxPort(async () => ({
    data: { providerEventId: 'event-row-1', invoiceId: 'invoice-row-1', amountMinor: 2.5, currency: 'TRY' },
    error: null,
  }))
  assert.equal((await invalid.ingest(event)).ok, false)

  const calls: string[] = []
  const marking = createSubscriptionBillingWebhookInboxPort(async (name) => {
    calls.push(name)
    return { data: true, error: null }
  })
  assert.equal((await marking.markFailed({
    providerEventId: 'event-row-1', reason: 'transition failed', sanitizedPayload: {},
  })).ok, true)
  assert.deepEqual(calls, ['mark_subscription_billing_provider_event_failed'])
})
