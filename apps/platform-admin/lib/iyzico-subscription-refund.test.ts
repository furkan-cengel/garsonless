import assert from 'node:assert/strict'
import test from 'node:test'
import { createHmac } from 'node:crypto'
import {
  createIyzicoSubscriptionRefundProvider,
  readIyzicoSubscriptionRefundConfig,
  type IyzicoRefundClient,
} from './iyzico-subscription-refund'

const config = { apiKey: 'key', secretKey: 'secret', baseUrl: 'https://sandbox-api.iyzipay.com' }
function client(response: Record<string, unknown>, target: 'refund' | 'cancel' = 'refund'): IyzicoRefundClient {
  return {
    refundV2: { create(_request, callback) {
      if (target !== 'refund') throw new Error('unexpected refund')
      callback(null, response)
    } },
    cancel: { create(_request, callback) {
      if (target !== 'cancel') throw new Error('unexpected cancel')
      callback(null, response)
    } },
  }
}

test('Refund V2 succeeds only with exact money, identity and documented response signature', async () => {
  const signature = createHmac('sha256', config.secretKey)
    .update('payment-1:100:TRY:00000000-0000-4000-8000-000000000001').digest('hex')
  const provider = createIyzicoSubscriptionRefundProvider(config, { client: client({
    status: 'success', paymentId: 'payment-1', price: 100, currency: 'TRY',
    conversationId: '00000000-0000-4000-8000-000000000001', refundHostReference: 'refund-1', signature,
  }) })
  assert.deepEqual(await provider.execute({
    refundId: '00000000-0000-4000-8000-000000000001', kind: 'refund',
    accessAction: 'keep',
    providerPaymentId: 'payment-1', amountMinor: 10_000,
  }), { outcome: 'succeeded', providerPaymentId: 'payment-1', providerRefundRef: 'refund-1', amountMinor: 10_000 })
})

test('same-day cancellation requires exact authenticated response fields and full amount is enforced by DB', async () => {
  const provider = createIyzicoSubscriptionRefundProvider(config, { client: client({
    status: 'success', paymentId: 'payment-1', price: '100.00', currency: 'TRY',
    conversationId: '00000000-0000-4000-8000-000000000001', cancelHostReference: 'cancel-1',
  }, 'cancel') })
  assert.equal((await provider.execute({
    refundId: '00000000-0000-4000-8000-000000000001', kind: 'same_day_cancel',
    accessAction: 'cancel_immediately',
    providerPaymentId: 'payment-1', amountMinor: 10_000,
  })).outcome, 'succeeded')
})

test('provider identity or signature drift is quarantined as uncertain', async () => {
  const provider = createIyzicoSubscriptionRefundProvider(config, { client: client({
    status: 'success', paymentId: 'foreign', price: 100, currency: 'TRY',
    conversationId: '00000000-0000-4000-8000-000000000001', refundHostReference: 'refund-1',
    signature: '0'.repeat(64),
  }) })
  assert.deepEqual(await provider.execute({
    refundId: '00000000-0000-4000-8000-000000000001', kind: 'refund',
    accessAction: 'keep',
    providerPaymentId: 'payment-1', amountMinor: 10_000,
  }), { outcome: 'uncertain', code: 'provider_response_mismatch' })
})

test('refund provider config keeps sandbox/live and feature gates explicit', () => {
  assert.throws(() => readIyzicoSubscriptionRefundConfig({}), /SAAS_BILLING_FINANCIAL_OPS_ENABLED/)
  assert.throws(() => readIyzicoSubscriptionRefundConfig({
    SAAS_BILLING_FINANCIAL_OPS_ENABLED: 'true', IYZICO_BILLING_BASE_URL: 'https://example.com',
    IYZICO_BILLING_API_KEY: 'key', IYZICO_BILLING_SECRET_KEY: 'secret',
  }), /approved iyzico API origin/)
})
