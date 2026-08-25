import assert from 'node:assert/strict'
import test from 'node:test'
import type { SubscriptionBillingCustomer } from '@garsonless/application/billing'
import {
  createIyzicoSubscriptionBillingProvider,
  readIyzicoSubscriptionProviderConfig,
  type IyzicoSubscriptionClient,
  type IyzicoSubscriptionProviderConfig,
} from './iyzico-subscription-provider'

type Callback = (error: Error | null, response: Record<string, unknown>) => void

const config: IyzicoSubscriptionProviderConfig = {
  apiKey: 'platform-api-key',
  secretKey: 'platform-secret-key',
  baseUrl: 'https://sandbox-api.iyzipay.com',
  vatRate: 20,
  plans: {
    starter: {
      monthly: { referenceCode: 'plan-starter-monthly', amountMinor: 41_880 },
      annual: { referenceCode: 'plan-starter-annual', amountMinor: 402_048 },
    },
    plus: {
      monthly: { referenceCode: 'plan-plus-monthly', amountMinor: 83_880 },
      annual: { referenceCode: 'plan-plus-annual', amountMinor: 805_248 },
    },
    pro: {
      monthly: { referenceCode: 'plan-pro-monthly', amountMinor: 143_880 },
      annual: { referenceCode: 'plan-pro-annual', amountMinor: 1_381_248 },
    },
  },
  addOns: {
    iyzico_online_payments: {
      monthly: { referenceCode: 'plan-pro-addon-monthly', amountMinor: 179_880, addOnNetAmountMinor: 30_000 },
      annual: { referenceCode: 'plan-pro-addon-annual', amountMinor: 1_726_848, addOnNetAmountMinor: 288_000 },
    },
  },
}

const address = {
  contactName: 'Masabu Test',
  city: 'İstanbul',
  district: 'Kadıköy',
  country: 'Türkiye',
  address: 'Test Sokak No: 1',
  zipCode: '34710',
}

const customer: SubscriptionBillingCustomer = {
  name: 'Masabu',
  surname: 'Test',
  identityNumber: '11111111111',
  email: 'OWNER@EXAMPLE.COM',
  gsmNumber: '+905551112233',
  billingAddress: address,
  shippingAddress: address,
}

function clientWith(
  handlers: Partial<Record<'customer' | 'checkout' | 'retrieve' | 'search' | 'retry' | 'cancel',
    (request: Record<string, unknown>, callback: Callback) => void>>,
): IyzicoSubscriptionClient {
  const missing = (_request: Record<string, unknown>, callback: Callback) => {
    callback(new Error('unexpected call'), {})
  }
  return {
    subscriptionCustomer: { create: handlers.customer ?? missing },
    subscriptionCheckoutForm: {
      initialize: handlers.checkout ?? missing,
      retrieve: handlers.retrieve ?? missing,
    },
    subscriptionPayment: { retry: handlers.retry ?? missing },
    subscription: {
      cancel: handlers.cancel ?? missing,
      search: handlers.search ?? missing,
    },
  }
}

test('platform config is explicit and rejects generic/fallback origins', () => {
  const env = {
    SAAS_BILLING_ENABLED: 'true',
    IYZICO_BILLING_API_KEY: 'api',
    IYZICO_BILLING_SECRET_KEY: 'secret',
    IYZICO_BILLING_BASE_URL: 'https://example.com',
    INVOICE_VAT_RATE: '20',
    IYZICO_BILLING_STARTER_MONTHLY_PLAN_REF: 'starter-monthly',
    IYZICO_BILLING_STARTER_MONTHLY_AMOUNT_MINOR: '41880',
    IYZICO_BILLING_STARTER_ANNUAL_PLAN_REF: 'starter-annual',
    IYZICO_BILLING_STARTER_ANNUAL_AMOUNT_MINOR: '402048',
    IYZICO_BILLING_PLUS_MONTHLY_PLAN_REF: 'plus-monthly',
    IYZICO_BILLING_PLUS_MONTHLY_AMOUNT_MINOR: '83880',
    IYZICO_BILLING_PLUS_ANNUAL_PLAN_REF: 'plus-annual',
    IYZICO_BILLING_PLUS_ANNUAL_AMOUNT_MINOR: '805248',
    IYZICO_BILLING_PRO_MONTHLY_PLAN_REF: 'pro-monthly',
    IYZICO_BILLING_PRO_MONTHLY_AMOUNT_MINOR: '143880',
    IYZICO_BILLING_PRO_ANNUAL_PLAN_REF: 'pro-annual',
    IYZICO_BILLING_PRO_ANNUAL_AMOUNT_MINOR: '1381248',
  }
  assert.throws(() => readIyzicoSubscriptionProviderConfig(env), /approved iyzico API origin/)
  assert.deepEqual(readIyzicoSubscriptionProviderConfig({
    ...env, IYZICO_BILLING_BASE_URL: config.baseUrl,
  }).plans.pro.monthly, { referenceCode: 'pro-monthly', amountMinor: 143_880 })
  assert.throws(() => readIyzicoSubscriptionProviderConfig({
    ...env, NODE_ENV: 'production', IYZICO_BILLING_BASE_URL: config.baseUrl,
  }), /live origin in production/)
  assert.throws(() => readIyzicoSubscriptionProviderConfig({
    ...env,
    IYZICO_BILLING_BASE_URL: config.baseUrl,
    IYZICO_BILLING_PRO_MONTHLY_PLAN_REF: 'starter-monthly',
  }), /must be unique/)
  assert.throws(() => readIyzicoSubscriptionProviderConfig({
    ...env,
    IYZICO_BILLING_BASE_URL: config.baseUrl,
    IYZICO_BILLING_PRO_MONTHLY_AMOUNT_MINOR: '29.99',
  }), /positive TRY minor-unit integer/)
})

test('customer creation sends normalized hosted-billing identity and resolves provider reference', async () => {
  const requests: Record<string, unknown>[] = []
  const provider = createIyzicoSubscriptionBillingProvider(config, {
    client: clientWith({
      customer(input, callback) {
        requests.push(input)
        callback(null, { status: 'success', data: { referenceCode: 'customer-ref' } })
      },
    }),
  })
  assert.deepEqual(await provider.createCustomer({
    restaurantId: 'restaurant-1', customer, idempotencyKey: 'customer-op-1',
  }), { ok: true, value: { providerCustomerRef: 'customer-ref' } })
  assert.equal(requests[0]?.['conversationId'], 'customer-op-1')
  assert.equal(requests[0]?.['email'], 'owner@example.com')
  assert.equal(requests[0]?.['identityNumber'], '11111111111')
})

test('checkout enforces local/provider plan amount parity and returns hosted content', async () => {
  let calls = 0
  const requests: Record<string, unknown>[] = []
  const provider = createIyzicoSubscriptionBillingProvider(config, {
    client: clientWith({
      checkout(input, callback) {
        calls += 1
        requests.push(input)
        callback(null, {
          status: 'success', token: 'checkout-token',
          checkoutFormContent: '<script>iyzico-hosted-form</script>',
        })
      },
    }),
  })
  const base = {
    customer,
    invoiceId: 'invoice-1',
    plan: 'starter' as const,
    interval: 'monthly' as const,
    callbackUrl: 'http://localhost:3000/api/billing/iyzico/callback',
    idempotencyKey: 'checkout-op-1',
  }
  assert.deepEqual(await provider.createCheckout({
    ...base, amount: { minor: 34_000, currency: 'TRY' },
  }), { ok: false, error: 'Iyzico subscription checkout input is invalid' })
  assert.equal(calls, 0)

  const result = await provider.createCheckout({
    ...base, amount: { minor: 41_880, currency: 'TRY' },
  })
  assert.equal(result.ok && result.value.providerCheckoutRef, 'checkout-token')
  assert.equal(result.ok && result.value.providerPlanRef, 'plan-starter-monthly')
  assert.equal(requests[0]?.['pricingPlanReferenceCode'], 'plan-starter-monthly')
  assert.equal(requests[0]?.['subscriptionInitialStatus'], 'ACTIVE')
  assert.equal(calls, 1)
})

test('Pro add-on checkout uses the dedicated combined provider plan', async () => {
  const requests: Record<string, unknown>[] = []
  const provider = createIyzicoSubscriptionBillingProvider(config, {
    client: clientWith({
      checkout(input, callback) {
        requests.push(input)
        callback(null, { status: 'success', token: 'addon-token', checkoutFormContent: '<form />' })
      },
    }),
  })
  const result = await provider.createCheckout({
    customer, invoiceId: 'invoice-addon', plan: 'pro', interval: 'monthly',
    addOns: ['iyzico_online_payments'], amount: { minor: 179_880, currency: 'TRY' },
    callbackUrl: 'http://localhost:3000/api/billing/iyzico/callback', idempotencyKey: 'addon-op',
  })
  assert.equal(result.ok && result.value.providerPlanRef, 'plan-pro-addon-monthly')
  assert.equal(requests[0]?.['pricingPlanReferenceCode'], 'plan-pro-addon-monthly')
  assert.deepEqual(await provider.createCheckout({
    customer, invoiceId: 'invoice-addon', plan: 'plus', interval: 'monthly',
    addOns: ['iyzico_online_payments'], amount: { minor: 179_880, currency: 'TRY' },
    callbackUrl: 'http://localhost:3000/api/billing/iyzico/callback', idempotencyKey: 'addon-op-2',
  }), { ok: false, error: 'Iyzico subscription checkout input is invalid' })
})

test('checkout retrieval maps only complete provider aggregate references', async () => {
  const provider = createIyzicoSubscriptionBillingProvider(config, {
    client: clientWith({
      retrieve(_input, callback) {
        callback(null, {
          status: 'success',
          data: {
            customerReferenceCode: 'customer-ref',
            referenceCode: 'subscription-ref',
            pricingPlanReferenceCode: 'plan-starter',
            subscriptionStatus: 'ACTIVE',
          },
        })
      },
      search(_input, callback) {
        callback(null, {
          status: 'success',
          data: {
            items: [{
              referenceCode: 'subscription-ref',
              orders: [{
                referenceCode: 'invoice-ref',
                startPeriod: Date.parse('2026-07-01T00:00:00.000Z'),
                endPeriod: Date.parse('2026-08-01T00:00:00.000Z'),
              }],
            }],
          },
        })
      },
    }),
  })
  assert.deepEqual(await provider.retrieveCheckout({
    providerCheckoutRef: 'checkout-token', idempotencyKey: 'retrieve-op-1',
    expectedProviderPlanRef: 'plan-starter',
  }), {
    ok: true,
    value: {
      providerCustomerRef: 'customer-ref',
      providerSubscriptionRef: 'subscription-ref',
      providerPlanRef: 'plan-starter',
      providerInvoiceRef: 'invoice-ref',
      periodStart: '2026-07-01T00:00:00.000Z',
      periodEnd: '2026-08-01T00:00:00.000Z',
      status: 'active',
    },
  })
})

test('checkout retrieval rejects a provider plan substitution before order lookup', async () => {
  let searches = 0
  const provider = createIyzicoSubscriptionBillingProvider(config, {
    client: clientWith({
      retrieve(_input, callback) {
        callback(null, {
          status: 'success',
          data: {
            customerReferenceCode: 'customer-ref',
            referenceCode: 'subscription-ref',
            pricingPlanReferenceCode: 'plan-enterprise',
            subscriptionStatus: 'ACTIVE',
          },
        })
      },
      search(_input, callback) {
        searches += 1
        callback(null, { status: 'success', data: { items: [] } })
      },
    }),
  })
  assert.deepEqual(await provider.retrieveCheckout({
    providerCheckoutRef: 'checkout-token', idempotencyKey: 'retrieve-op-1',
    expectedProviderPlanRef: 'plan-starter',
  }), { ok: false, error: 'Iyzico subscription checkout plan does not match the claimed operation' })
  assert.equal(searches, 0)
})

test('retry uses failed order reference and cancellation is immediate only', async () => {
  const retryRequests: Record<string, unknown>[] = []
  const cancelRequests: Record<string, unknown>[] = []
  const provider = createIyzicoSubscriptionBillingProvider(config, {
    now: () => Date.parse('2026-07-22T15:00:00.000Z'),
    client: clientWith({
      retry(input, callback) {
        retryRequests.push(input)
        callback(null, { status: 'success', systemTime: 1 })
      },
      cancel(input, callback) {
        cancelRequests.push(input)
        callback(null, { status: 'success', systemTime: 1 })
      },
    }),
  })
  assert.deepEqual(await provider.retryInvoice({
    providerPaymentRef: 'failed-order-ref', invoiceId: 'invoice-1', idempotencyKey: 'retry-op-1',
  }), { ok: true, value: { accepted: true } })
  assert.equal(retryRequests[0]?.['referenceCode'], 'failed-order-ref')

  assert.deepEqual(await provider.cancelSubscription({
    providerSubscriptionRef: 'subscription-ref', idempotencyKey: 'cancel-op-1',
  }), { ok: true, value: { cancelledAt: '2026-07-22T15:00:00.000Z' } })
  assert.equal(cancelRequests[0]?.['subscriptionReferenceCode'], 'subscription-ref')
})

test('provider failures expose stable internal code only, not provider message', async () => {
  const provider = createIyzicoSubscriptionBillingProvider(config, {
    client: clientWith({
      retry(_input, callback) {
        callback(null, {
          status: 'failure', errorCode: '10051',
          errorMessage: 'sensitive provider diagnostic',
        })
      },
    }),
  })
  assert.deepEqual(await provider.retryInvoice({
    providerPaymentRef: 'failed-order-ref', invoiceId: 'invoice-1', idempotencyKey: 'retry-op-1',
  }), { ok: false, error: 'Iyzico subscription operation failed (10051)' })
})
