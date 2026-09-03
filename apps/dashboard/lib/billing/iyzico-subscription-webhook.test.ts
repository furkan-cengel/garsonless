import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import test from 'node:test'
import {
  createIyzicoSubscriptionWebhookVerifier,
  signIyzicoSubscriptionWebhookForTest,
} from './iyzico-subscription-webhook'

const config = { merchantId: 'merchant-fixture', secretKey: 'secret-fixture' }
const now = Date.parse('2026-07-22T12:00:00.000Z')
const payload = {
  iyziReferenceCode: 'event-1',
  iyziEventType: 'subscription.order.success' as const,
  iyziEventTime: now - 1_000,
  subscriptionReferenceCode: 'subscription-1',
  orderReferenceCode: 'invoice-1',
  customerReferenceCode: 'customer-1',
}

function request(
  body: Omit<typeof payload, 'iyziEventType'> & {
    iyziEventType: 'subscription.order.success' | 'subscription.order.failure'
  } = payload,
  signature?: string,
) {
  const rawBody = new TextEncoder().encode(JSON.stringify(body))
  return {
    rawBody,
    headers: {
      'x-iyz-signature-v3': signature ?? signIyzicoSubscriptionWebhookForTest(config, body),
    },
  }
}

test('iyzico subscription V3 signature follows the documented merchant-id-first field order', () => {
  const message = config.merchantId
    + config.secretKey
    + payload.iyziEventType
    + payload.subscriptionReferenceCode
    + payload.orderReferenceCode
    + payload.customerReferenceCode
  const expected = createHmac('sha256', config.secretKey).update(message, 'utf8').digest('hex')

  assert.equal(signIyzicoSubscriptionWebhookForTest(config, payload), expected)
})

test('iyzico subscription V3 rejects the legacy secret-key-first ordering', async () => {
  const legacyMessage = config.secretKey
    + config.merchantId
    + payload.iyziEventType
    + payload.subscriptionReferenceCode
    + payload.orderReferenceCode
    + payload.customerReferenceCode
  const legacySignature = createHmac('sha256', config.secretKey)
    .update(legacyMessage, 'utf8')
    .digest('hex')

  assert.deepEqual(
    await createIyzicoSubscriptionWebhookVerifier(config, () => now)
      .verifyWebhook(request(payload, legacySignature)),
    { ok: false, error: 'Iyzico billing webhook signature is invalid' },
  )
})

test('iyzico subscription webhook verifies V3 signature and returns only allowlisted refs', async () => {
  const result = await createIyzicoSubscriptionWebhookVerifier(config, () => now).verifyWebhook(request())
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.value.type, 'invoice.payment_succeeded')
  assert.equal(result.value.amount, null)
  assert.equal(result.value.providerInvoiceRef, 'invoice-1')
  assert.deepEqual(Object.keys(result.value.sanitizedPayload).sort(), [
    'customerReferenceCode', 'iyziEventTime', 'iyziEventType', 'iyziReferenceCode',
    'orderReferenceCode', 'subscriptionReferenceCode',
  ])
  assert.match(result.value.payloadHash, /^[a-f0-9]{64}$/)
})

test('iyzico subscription webhook rejects invalid signatures, unsupported events and future timestamps', async () => {
  const verifier = createIyzicoSubscriptionWebhookVerifier(config, () => now)
  assert.deepEqual(await verifier.verifyWebhook(request(payload, '0'.repeat(64))), {
    ok: false, error: 'Iyzico billing webhook signature is invalid',
  })
  const unsupported = { ...payload, iyziEventType: 'subscription.upgraded' }
  assert.deepEqual(await verifier.verifyWebhook({
    rawBody: new TextEncoder().encode(JSON.stringify(unsupported)),
    headers: { 'x-iyz-signature-v3': '0'.repeat(64) },
  }), { ok: false, error: 'Iyzico billing webhook payload is invalid' })
  const future = { ...payload, iyziEventTime: now + 6 * 60_000 }
  assert.deepEqual(await verifier.verifyWebhook({
    rawBody: new TextEncoder().encode(JSON.stringify(future)),
    headers: { 'x-iyz-signature-v3': '0'.repeat(64) },
  }), { ok: false, error: 'Iyzico billing webhook payload is invalid' })
})

test('iyzico subscription failure maps to the provider-independent failure event', async () => {
  const failure = { ...payload, iyziEventType: 'subscription.order.failure' as const }
  const result = await createIyzicoSubscriptionWebhookVerifier(config, () => now)
    .verifyWebhook(request(failure))
  assert.equal(result.ok && result.value.type, 'invoice.payment_failed')
})
