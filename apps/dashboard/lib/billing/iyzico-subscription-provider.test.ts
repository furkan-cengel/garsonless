import assert from 'node:assert/strict'
import test from 'node:test'
import type { SubscriptionBillingCustomer } from '@garsonless/application/billing'
import {
  createIyzicoSubscriptionBillingProvider,
  assertIyzicoSubscriptionSalesEnabled,
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
      pro: {
        monthly: { referenceCode: 'plan-pro-addon-monthly', amountMinor: 179_880, addOnNetAmountMinor: 30_000 },
        annual: { referenceCode: 'plan-pro-addon-annual', amountMinor: 1_726_848, addOnNetAmountMinor: 288_000 },
      },
    },
    storefront_video_hero: {
      starter: {
        monthly: { referenceCode: 'plan-starter-video-monthly', amountMinor: 46_560, addOnNetAmountMinor: 3_900 },
        annual: { referenceCode: 'plan-starter-video-annual', amountMinor: 446_976, addOnNetAmountMinor: 37_440 },
      },
      plus: {
        monthly: { referenceCode: 'plan-plus-video-monthly', amountMinor: 88_560, addOnNetAmountMinor: 3_900 },
        annual: { referenceCode: 'plan-plus-video-annual', amountMinor: 850_176, addOnNetAmountMinor: 37_440 },
      },
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

function hostedCheckoutContent(environment: 'sandbox' | 'live' = 'sandbox'): string {
  const api = environment === 'sandbox' ? 'sandbox-api.iyzipay.com' : 'api.iyzipay.com'
  const staticHost = environment === 'sandbox' ? 'sandbox-static.iyzipay.com' : 'static.iyzipay.com'
  return `<script type="text/javascript">var iyziInit={baseUrl:'https://${api}',createTag:function(){var tag=document.createElement('script');tag.setAttribute('src','https://${staticHost}/checkoutform/v2/bundle.js');document.head.appendChild(tag);}};iyziInit.createTag();</script>`
}

function clientWith(
  handlers: Partial<Record<'customer' | 'checkout' | 'retrieve' | 'search' | 'retry' | 'cancel' | 'upgrade' | 'cardUpdate',
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
    subscriptionCard: { updateWithSubscriptionReferenceCode: handlers.cardUpdate ?? missing },
    subscription: {
      cancel: handlers.cancel ?? missing,
      search: handlers.search ?? missing,
      upgrade: handlers.upgrade ?? missing,
    },
  }
}

test('card update uses the subscription-scoped hosted form and validates its environment', async () => {
  const requests: Record<string, unknown>[] = []
  const now = Date.parse('2026-09-01T12:00:00.000Z')
  const provider = createIyzicoSubscriptionBillingProvider(config, {
    now: () => now,
    client: clientWith({
      cardUpdate(input, callback) {
        requests.push(input)
        callback(null, {
          status: 'success', token: 'card-update-token', tokenExpireTime: 1800,
          checkoutFormContent: hostedCheckoutContent(),
        })
      },
    }),
  })
  const result = await provider.initializeSubscriptionCardUpdate({
    providerSubscriptionRef: 'subscription-1',
    callbackUrl: 'https://app.masabu.co/api/billing/iyzico/card-update/callback?state=opaque',
    idempotencyKey: 'card-update-1',
  })
  assert.deepEqual(result, { ok: true, value: {
    providerCheckoutRef: 'card-update-token',
    checkoutContent: hostedCheckoutContent(),
    expiresAt: '2026-09-01T12:30:00.000Z',
  } })
  assert.deepEqual(requests[0], {
    locale: 'tr', conversationId: 'card-update-1',
    subscriptionReferenceCode: 'subscription-1',
    callbackUrl: 'https://app.masabu.co/api/billing/iyzico/card-update/callback?state=opaque',
  })
})

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
    ...env, SAAS_BILLING_ENABLED: 'false', IYZICO_BILLING_BASE_URL: config.baseUrl,
  }).plans.pro.monthly, { referenceCode: 'pro-monthly', amountMinor: 143_880 })
  assert.throws(() => assertIyzicoSubscriptionSalesEnabled({
    SAAS_BILLING_ENABLED: 'false',
  }), /SAAS_BILLING_SALES_ENABLED/)
  assert.doesNotThrow(() => assertIyzicoSubscriptionSalesEnabled({
    SAAS_BILLING_ENABLED: 'false', SAAS_BILLING_SALES_ENABLED: 'true',
  }))
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
  const now = Date.parse('2026-09-01T12:00:00.000Z')
  const provider = createIyzicoSubscriptionBillingProvider(config, {
    now: () => now,
    client: clientWith({
      checkout(input, callback) {
        calls += 1
        requests.push(input)
        callback(null, {
          status: 'success', token: 'checkout-token',
          tokenExpireTime: 1800,
          checkoutFormContent: hostedCheckoutContent(),
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
  assert.equal(result.ok && result.value.expiresAt, '2026-09-01T12:30:00.000Z')
  assert.equal(result.ok && result.value.providerPlanRef, 'plan-starter-monthly')
  assert.equal(requests[0]?.['pricingPlanReferenceCode'], 'plan-starter-monthly')
  assert.equal(requests[0]?.['subscriptionInitialStatus'], 'ACTIVE')
  assert.equal(calls, 1)
})

test('checkout accepts a future absolute token expiry for provider compatibility', async () => {
  const now = Date.parse('2026-09-01T12:00:00.000Z')
  const expiresAt = Date.parse('2026-09-01T12:30:00.000Z')
  const provider = createIyzicoSubscriptionBillingProvider(config, {
    now: () => now,
    client: clientWith({
      checkout(_input, callback) {
        callback(null, {
          status: 'success', token: 'checkout-token', tokenExpireTime: expiresAt,
          checkoutFormContent: hostedCheckoutContent(),
        })
      },
    }),
  })
  const result = await provider.createCheckout({
    customer, invoiceId: 'invoice-absolute-expiry', plan: 'starter', interval: 'monthly',
    amount: { minor: 41_880, currency: 'TRY' },
    callbackUrl: 'http://localhost:3000/api/billing/iyzico/callback',
    idempotencyKey: 'checkout-absolute-expiry',
  })
  assert.equal(result.ok && result.value.expiresAt, '2026-09-01T12:30:00.000Z')
})

test('Pro add-on checkout uses the dedicated combined provider plan', async () => {
  const requests: Record<string, unknown>[] = []
  const provider = createIyzicoSubscriptionBillingProvider(config, {
    client: clientWith({
      checkout(input, callback) {
        requests.push(input)
        callback(null, { status: 'success', token: 'addon-token', checkoutFormContent: hostedCheckoutContent() })
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

test('Video Hero checkout uses only its canonical Starter or Plus combined plan', async () => {
  const requests: Record<string, unknown>[] = []
  const provider = createIyzicoSubscriptionBillingProvider(config, {
    client: clientWith({
      checkout(input, callback) {
        requests.push(input)
        callback(null, { status: 'success', token: 'video-token', checkoutFormContent: hostedCheckoutContent() })
      },
    }),
  })
  const result = await provider.createCheckout({
    customer, invoiceId: 'invoice-video', plan: 'starter', interval: 'monthly',
    addOns: ['storefront_video_hero'], amount: { minor: 46_560, currency: 'TRY' },
    callbackUrl: 'http://localhost:3000/api/billing/iyzico/callback', idempotencyKey: 'video-op',
  })
  assert.equal(result.ok && result.value.providerPlanRef, 'plan-starter-video-monthly')
  assert.equal(requests[0]?.['pricingPlanReferenceCode'], 'plan-starter-video-monthly')
  assert.deepEqual(await provider.createCheckout({
    customer, invoiceId: 'invoice-video-pro', plan: 'pro', interval: 'monthly',
    addOns: ['storefront_video_hero'], amount: { minor: 46_560, currency: 'TRY' },
    callbackUrl: 'http://localhost:3000/api/billing/iyzico/callback', idempotencyKey: 'video-op-pro',
  }), { ok: false, error: 'Iyzico subscription checkout input is invalid' })
})

test('checkout rejects malformed, foreign-host, and cross-environment provider content', async () => {
  const contents = [
    '<form />',
    hostedCheckoutContent().replace('sandbox-static.iyzipay.com', 'attacker.example'),
    hostedCheckoutContent('live'),
  ]
  for (const checkoutFormContent of contents) {
    const provider = createIyzicoSubscriptionBillingProvider(config, {
      client: clientWith({
        checkout(_input, callback) {
          callback(null, { status: 'success', token: 'checkout-token', checkoutFormContent })
        },
      }),
    })
    assert.deepEqual(await provider.createCheckout({
      customer, invoiceId: 'invoice-1', plan: 'starter', interval: 'monthly',
      amount: { minor: 41_880, currency: 'TRY' },
      callbackUrl: 'http://localhost:3000/api/billing/iyzico/callback', idempotencyKey: 'checkout-op-1',
    }), { ok: false, error: 'Iyzico subscription checkout response is invalid' })
  }
})

test('checkout retrieval maps only complete provider aggregate references', async () => {
  const activationPeriodStart = Date.parse('2026-07-01T00:00:00.000Z')
  // Sandbox can report subscription startDate one millisecond before the
  // matching paid order's startPeriod. This bounded drift must not quarantine
  // an otherwise exact, uniquely paid activation order.
  const subscriptionStart = activationPeriodStart - 1
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
            trialDays: 0,
            startDate: subscriptionStart,
          },
        })
      },
      search(input, callback) {
        assert.equal(input.count, 20)
        callback(null, {
          status: 'success',
          data: {
            items: [{
              referenceCode: 'subscription-ref',
              customerReferenceCode: 'customer-ref',
              pricingPlanReferenceCode: 'plan-starter',
              startDate: subscriptionStart,
              orders: [{
                referenceCode: 'future-invoice-ref',
                orderStatus: 'WAITING',
                paymentAttempts: [],
                startPeriod: Date.parse('2026-08-01T00:00:00.000Z'),
                endPeriod: Date.parse('2026-09-01T00:00:00.000Z'),
              }, {
                referenceCode: 'invoice-ref',
                orderStatus: 'SUCCESS',
                price: 418.8,
                currencyCode: 'TRY',
                paymentAttempts: [{ paymentStatus: 'SUCCESS', paymentId: 123_456_789 }],
                startPeriod: activationPeriodStart,
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
    expectedAmount: { minor: 41_880, currency: 'TRY' },
    expectedBillingInterval: 'monthly',
  }), {
    ok: true,
    value: {
      providerCustomerRef: 'customer-ref',
      providerSubscriptionRef: 'subscription-ref',
      providerPlanRef: 'plan-starter',
      providerInvoiceRef: 'invoice-ref',
      providerPaymentId: '123456789',
      providerOrderStatus: 'succeeded',
      amount: { minor: 41_880, currency: 'TRY' },
      periodStart: '2026-07-01T00:00:00.000Z',
      periodEnd: '2026-08-01T00:00:00.000Z',
      status: 'active',
    },
  })
})

test('checkout retrieval quarantines activation status, money, period and identity drift', async () => {
  const activationStart = Date.parse('2026-07-01T00:00:00.000Z')
  const validOrder = {
    referenceCode: 'invoice-ref', orderStatus: 'SUCCESS', price: 418.8, currencyCode: 'TRY',
    paymentAttempts: [{ paymentStatus: 'SUCCESS', paymentId: 'payment-1' }],
    startPeriod: activationStart, endPeriod: Date.parse('2026-08-01T00:00:00.000Z'),
  }
  const cases: Record<string, unknown>[][] = [
    [{ ...validOrder, orderStatus: 'WAITING' }],
    [{ ...validOrder, price: 418.79 }],
    [{ ...validOrder, currencyCode: 'USD' }],
    [{ ...validOrder, endPeriod: Date.parse('2026-08-02T00:00:00.000Z') }],
    [{ ...validOrder,
      startPeriod: activationStart + 1_001,
      endPeriod: Date.parse('2026-08-01T00:00:01.001Z'),
    }],
    [validOrder, { ...validOrder, referenceCode: 'duplicate-activation' }],
    [{ ...validOrder, paymentAttempts: [
      { paymentStatus: 'SUCCESS', paymentId: 'payment-1' },
      { paymentStatus: 'SUCCESS', paymentId: 'payment-2' },
    ] }],
  ]
  for (const orders of cases) {
    const provider = createIyzicoSubscriptionBillingProvider(config, {
      client: clientWith({
        retrieve(_input, callback) {
          callback(null, { status: 'success', data: {
            customerReferenceCode: 'customer-ref', referenceCode: 'subscription-ref',
            pricingPlanReferenceCode: 'plan-starter', subscriptionStatus: 'ACTIVE',
            trialDays: 0, startDate: activationStart,
          } })
        },
        search(_input, callback) {
          callback(null, { status: 'success', data: { items: [{
            referenceCode: 'subscription-ref', customerReferenceCode: 'customer-ref',
            pricingPlanReferenceCode: 'plan-starter', startDate: activationStart, orders,
          }] } })
        },
      }),
    })
    assert.deepEqual(await provider.probeCheckout({
      providerCheckoutRef: 'checkout-token', idempotencyKey: 'retrieve-drift',
      expectedProviderPlanRef: 'plan-starter',
      expectedAmount: { minor: 41_880, currency: 'TRY' },
      expectedBillingInterval: 'monthly',
    }), { ok: true, value: { outcome: 'ambiguous' } })
  }
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
            trialDays: 0,
            startDate: Date.parse('2026-07-01T00:00:00.000Z'),
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
    expectedAmount: { minor: 41_880, currency: 'TRY' },
    expectedBillingInterval: 'monthly',
  }), { ok: false, error: 'Iyzico subscription checkout plan does not match the claimed operation' })
  assert.equal(searches, 0)
})

test('renewal order retrieval binds exact refs, configured amount and provider period', async () => {
  const provider = createIyzicoSubscriptionBillingProvider(config, {
    client: clientWith({
      search(input, callback) {
        assert.equal(input.subscriptionReferenceCode, 'subscription-ref')
        callback(null, {
          status: 'success',
          data: { items: [{
            referenceCode: 'subscription-ref',
            customerReferenceCode: 'customer-ref',
            pricingPlanReferenceCode: 'plan-pro-monthly',
            orders: [{
              referenceCode: 'renewal-order-2', price: 1438.8, currencyCode: 'TRY',
              paymentAttempts: [{ paymentStatus: 'SUCCESS', paymentId: 'payment-renewal-2' }],
              startPeriod: Date.parse('2026-08-01T00:00:00.000Z'),
              endPeriod: Date.parse('2026-09-01T00:00:00.000Z'),
              orderStatus: 'SUCCESS',
            }],
          }] },
        })
      },
    }),
  })
  assert.deepEqual(await provider.retrieveSubscriptionOrder({
    providerCustomerRef: 'customer-ref', providerSubscriptionRef: 'subscription-ref',
    providerInvoiceRef: 'renewal-order-2', idempotencyKey: 'renewal-lookup-2',
  }), {
    ok: true,
    value: {
      providerCustomerRef: 'customer-ref', providerSubscriptionRef: 'subscription-ref',
      providerInvoiceRef: 'renewal-order-2', providerPaymentId: 'payment-renewal-2',
      providerPlanRef: 'plan-pro-monthly',
      plan: 'pro', addOns: [], billingInterval: 'monthly',
      amount: { minor: 143_880, currency: 'TRY' },
      periodStart: '2026-08-01T00:00:00.000Z', periodEnd: '2026-09-01T00:00:00.000Z',
      status: 'succeeded',
    },
  })
})

test('renewal order retrieval fails closed on foreign order, price and plan drift', async () => {
  for (const change of [
    { referenceCode: 'foreign-order', price: 1438.8, pricingPlanReferenceCode: 'plan-pro-monthly' },
    { referenceCode: 'renewal-order', price: 1, pricingPlanReferenceCode: 'plan-pro-monthly' },
    { referenceCode: 'renewal-order', price: 1438.8, pricingPlanReferenceCode: 'foreign-plan' },
  ]) {
    const provider = createIyzicoSubscriptionBillingProvider(config, {
      client: clientWith({
        search(_input, callback) {
          callback(null, { status: 'success', data: { items: [{
            referenceCode: 'subscription-ref', customerReferenceCode: 'customer-ref',
            pricingPlanReferenceCode: change.pricingPlanReferenceCode,
            orders: [{
              referenceCode: change.referenceCode, price: change.price, currencyCode: 'TRY',
              startPeriod: 1785542400000, endPeriod: 1788220800000, orderStatus: 'SUCCESS',
            }],
          }] } })
        },
      }),
    })
    const result = await provider.retrieveSubscriptionOrder({
      providerCustomerRef: 'customer-ref', providerSubscriptionRef: 'subscription-ref',
      providerInvoiceRef: 'renewal-order', idempotencyKey: 'renewal-drift',
    })
    assert.equal(result.ok, false)
  }
})

test('checkout probe maps iyzico 201601 to incomplete without leaking provider diagnostics', async () => {
  const provider = createIyzicoSubscriptionBillingProvider(config, {
    client: clientWith({
      retrieve(_input, callback) {
        callback(null, {
          status: 'failure',
          errorCode: '201601',
          errorMessage: 'Ödeme formu tamamlanmamış.',
        })
      },
    }),
  })
  assert.deepEqual(await provider.probeCheckout({
    providerCheckoutRef: 'checkout-token',
    idempotencyKey: 'probe-op-1',
    expectedProviderPlanRef: 'plan-starter',
    expectedAmount: { minor: 41_880, currency: 'TRY' },
    expectedBillingInterval: 'monthly',
  }), { ok: true, value: { outcome: 'incomplete' } })
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

test('cancellation reconciliation probes the exact subscription without mutating it', async () => {
  const searchRequests: Record<string, unknown>[] = []
  const provider = createIyzicoSubscriptionBillingProvider(config, {
    now: () => Date.parse('2026-09-02T14:00:00.000Z'),
    client: clientWith({
      search(input, callback) {
        searchRequests.push(input)
        callback(null, { status: 'success', data: { items: [{
          referenceCode: 'subscription-ref', subscriptionStatus: 'CANCELED',
        }] } })
      },
    }),
  })
  assert(provider.probeSubscriptionStatus)
  assert.deepEqual(await provider.probeSubscriptionStatus({
    providerSubscriptionRef: 'subscription-ref', idempotencyKey: 'probe-cancel-1',
  }), { ok: true, value: {
    status: 'cancelled', observedAt: '2026-09-02T14:00:00.000Z',
  } })
  assert.deepEqual(searchRequests, [{
    locale: 'tr', conversationId: 'probe-cancel-1',
    subscriptionReferenceCode: 'subscription-ref', page: 1, count: 20,
  }])
})

test('same-interval plan change is scheduled for next period and exact-bound to provider lineage', async () => {
  const requests: Record<string, unknown>[] = []
  const searchRequests: Record<string, unknown>[] = []
  const provider = createIyzicoSubscriptionBillingProvider(config, {
    client: clientWith({
      upgrade(input, callback) {
        requests.push(input)
        callback(null, { status: 'success', data: {
          referenceCode: 'subscription-child',
          parentReferenceCode: 'subscription-root',
          pricingPlanReferenceCode: 'plan-pro-monthly',
          subscriptionStatus: 'ACTIVE',
          startDate: Date.parse('2026-10-01T00:00:00.000Z'),
        } })
      },
      search(input, callback) {
        searchRequests.push(input)
        const referenceCode = input.subscriptionReferenceCode
        callback(null, { status: 'success', data: { items: referenceCode === 'subscription-parent'
          ? [{
            referenceCode: 'subscription-parent', parentReferenceCode: 'subscription-root',
            pricingPlanReferenceCode: 'plan-starter-monthly', subscriptionStatus: 'UPGRADED',
          }]
          : [{
            referenceCode: 'subscription-child', parentReferenceCode: 'subscription-root',
            pricingPlanReferenceCode: 'plan-pro-monthly', subscriptionStatus: 'ACTIVE',
            startDate: Date.parse('2026-10-01T00:00:00.000Z'),
            orders: [{
              referenceCode: 'scheduled-order', orderStatus: 'WAITING',
              startPeriod: Date.parse('2026-10-01T00:00:00.000Z'),
              endPeriod: Date.parse('2026-11-01T00:00:00.000Z'), paymentAttempts: [],
            }],
          }] } })
      },
    }),
  })
  const result = await provider.upgradeSubscription({
    providerSubscriptionRef: 'subscription-parent',
    providerTargetPlanRef: 'plan-pro-monthly',
    effectivePolicy: 'next_period',
    idempotencyKey: 'plan-change-1',
  })
  assert.deepEqual(result, { ok: true, value: {
    providerParentSubscriptionRef: 'subscription-parent',
    providerTargetSubscriptionRef: 'subscription-child',
    providerTargetPlanRef: 'plan-pro-monthly',
    providerStatus: 'active',
    providerPeriodStart: '2026-10-01T00:00:00.000Z',
    providerPeriodEnd: '2026-11-01T00:00:00.000Z',
  } })
  assert.deepEqual(requests[0], {
    locale: 'tr', conversationId: 'plan-change-1',
    subscriptionReferenceCode: 'subscription-parent',
    newPricingPlanReferenceCode: 'plan-pro-monthly',
    upgradePeriod: 'NEXT_PERIOD', useTrial: false, resetRecurrenceCount: false,
  })
  assert.deepEqual(searchRequests.map((request) => request.subscriptionReferenceCode), [
    'subscription-parent', 'subscription-child',
  ])
})

test('plan change rejects foreign parent, target plan and non-active provider results', async () => {
  for (const data of [
    { parentReferenceCode: 'foreign-parent', pricingPlanReferenceCode: 'plan-pro-monthly', subscriptionStatus: 'ACTIVE' },
    { parentReferenceCode: 'subscription-parent', pricingPlanReferenceCode: 'foreign-plan', subscriptionStatus: 'ACTIVE' },
    { parentReferenceCode: 'subscription-parent', pricingPlanReferenceCode: 'plan-pro-monthly', subscriptionStatus: 'PENDING' },
  ]) {
    const provider = createIyzicoSubscriptionBillingProvider(config, {
      client: clientWith({
        upgrade(_input, callback) {
          callback(null, { status: 'success', data: {
            referenceCode: 'subscription-child', ...data,
            startDate: Date.parse('2026-10-01T00:00:00.000Z'),
            endDate: Date.parse('2027-10-01T00:00:00.000Z'),
          } })
        },
      }),
    })
    assert.equal((await provider.upgradeSubscription({
      providerSubscriptionRef: 'subscription-parent',
      providerTargetPlanRef: 'plan-pro-monthly',
      effectivePolicy: 'next_period', idempotencyKey: 'plan-change-drift',
    })).ok, false)
  }
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
