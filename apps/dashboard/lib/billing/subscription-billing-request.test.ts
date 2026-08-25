import assert from 'node:assert/strict'
import test from 'node:test'
import {
  billingCheckoutCallbackUrl,
  billingDashboardUrl,
  billingPeriod,
  checkoutRequestSchema,
  readBillingPlanPrices,
  requestFingerprint,
} from './subscription-billing-request'

const address = {
  contactName: 'Masabu Test', city: 'İstanbul', district: null,
  country: 'Türkiye', address: 'Test Sokak No: 1', zipCode: null,
}

test('checkout input normalizes provider identity without accepting free or malformed identity', () => {
  const parsed = checkoutRequestSchema.parse({
    requestId: '11111111-1111-4111-8111-111111111111', plan: 'pro', interval: 'annual',
    checkoutTermsAccepted: true, legalDocumentVersion: '2026-08-16',
    profile: {
      legalName: ' Masabu Test AŞ ', taxOffice: 'Kartal', name: 'Masabu', surname: 'Test',
      identityNumber: '11111111111', email: 'OWNER@EXAMPLE.COM',
      gsmNumber: '+90 (555) 111 22 33', billingAddress: address, shippingAddress: address,
    },
  })
  assert.equal(parsed.profile.legalName, 'Masabu Test AŞ')
  assert.equal(parsed.profile.email, 'owner@example.com')
  assert.equal(parsed.profile.gsmNumber, '+905551112233')
  assert.deepEqual(parsed.addOns, [])
  assert.equal(checkoutRequestSchema.safeParse({
    ...parsed, plan: 'pro', addOns: ['iyzico_online_payments'],
  }).success, true)
  assert.equal(checkoutRequestSchema.safeParse({
    ...parsed, plan: 'plus', addOns: ['iyzico_online_payments'],
  }).success, false)
  assert.equal(checkoutRequestSchema.safeParse({ ...parsed, plan: 'free' }).success, false)
  assert.equal(checkoutRequestSchema.safeParse({ ...parsed, plan: 'business' }).success, false)
  assert.equal(checkoutRequestSchema.safeParse({ ...parsed, interval: 'weekly' }).success, false)
  assert.equal(checkoutRequestSchema.safeParse({
    ...parsed, profile: { ...parsed.profile, identityNumber: '123' },
  }).success, false)
})

test('billing request fingerprint is deterministic and changes with immutable intent', () => {
  const left = requestFingerprint({ restaurantId: 'r1', plan: 'pro', interval: 'monthly' })
  const replay = requestFingerprint({ restaurantId: 'r1', plan: 'pro', interval: 'monthly' })
  const changed = requestFingerprint({ restaurantId: 'r1', plan: 'starter', interval: 'monthly' })
  const annual = requestFingerprint({ restaurantId: 'r1', plan: 'pro', interval: 'annual' })
  assert.equal(left, replay)
  assert.notEqual(left, changed)
  assert.notEqual(left, annual)
  assert.match(left, /^[a-f0-9]{64}$/)
})

test('monthly period clamps end-of-month and callback URL is origin constrained', () => {
  assert.deepEqual(billingPeriod(new Date('2026-01-31T10:00:00.000Z'), 'monthly'), {
    periodStart: '2026-01-31T10:00:00.000Z',
    periodEnd: '2026-02-28T10:00:00.000Z',
    dueAt: '2026-01-31T10:00:00.000Z',
  })
  assert.deepEqual(billingPeriod(new Date('2024-02-29T10:00:00.000Z'), 'annual'), {
    periodStart: '2024-02-29T10:00:00.000Z',
    periodEnd: '2025-02-28T10:00:00.000Z',
    dueAt: '2024-02-29T10:00:00.000Z',
  })
  assert.equal(
    billingCheckoutCallbackUrl('https://app.masabu.co'),
    'https://app.masabu.co/api/billing/iyzico/checkout/callback',
  )
  assert.throws(() => billingCheckoutCallbackUrl('http://dashboard.example.com'), /origin is invalid/)
  assert.throws(() => billingDashboardUrl('/dashboard', undefined, 'production'), /origin is required/)
  assert.throws(() => billingDashboardUrl(
    '/dashboard', 'http://localhost:3000', 'production',
  ), /origin is invalid/)
  assert.throws(() => billingCheckoutCallbackUrl('https://app.masabu.co/base'), /origin is invalid/)
})

test('public catalogue prices stay visible while checkout readiness fails closed', () => {
  const complete = {
    SAAS_BILLING_ENABLED: 'true',
    IYZICO_BILLING_MERCHANT_ID: 'merchant-live',
    IYZICO_BILLING_API_KEY: 'platform-api-key',
    IYZICO_BILLING_SECRET_KEY: 'platform-secret-key',
    IYZICO_BILLING_BASE_URL: 'https://api.iyzipay.com',
    INVOICE_VAT_RATE: '20',
    IYZICO_BILLING_STARTER_MONTHLY_PLAN_REF: 'starter-monthly-live',
    IYZICO_BILLING_STARTER_MONTHLY_AMOUNT_MINOR: '41880',
    IYZICO_BILLING_STARTER_ANNUAL_PLAN_REF: 'starter-annual-live',
    IYZICO_BILLING_STARTER_ANNUAL_AMOUNT_MINOR: '402048',
    IYZICO_BILLING_PLUS_MONTHLY_PLAN_REF: 'plus-monthly-live',
    IYZICO_BILLING_PLUS_MONTHLY_AMOUNT_MINOR: '83880',
    IYZICO_BILLING_PLUS_ANNUAL_PLAN_REF: 'plus-annual-live',
    IYZICO_BILLING_PLUS_ANNUAL_AMOUNT_MINOR: '805248',
    IYZICO_BILLING_PRO_MONTHLY_PLAN_REF: 'pro-monthly-live',
    IYZICO_BILLING_PRO_MONTHLY_AMOUNT_MINOR: '143880',
    IYZICO_BILLING_PRO_ANNUAL_PLAN_REF: 'pro-annual-live',
    IYZICO_BILLING_PRO_ANNUAL_AMOUNT_MINOR: '1381248',
  }
  assert.deepEqual(readBillingPlanPrices(complete), {
    starter: { monthly: 34_900, annual: 335_040 },
    plus: { monthly: 69_900, annual: 671_040 },
    pro: { monthly: 119_900, annual: 1_151_040 },
    iyzicoOnlinePaymentsAddOn: { monthly: 30_000, annual: 288_000 },
    checkoutAvailable: true,
    iyzicoOnlinePaymentsAddOnCheckoutAvailable: false,
  })
  assert.deepEqual(readBillingPlanPrices({
    ...complete,
    IYZICO_BILLING_PRO_MONTHLY_AMOUNT_MINOR: '29.99',
  }), {
    starter: { monthly: 34_900, annual: 335_040 }, plus: { monthly: 69_900, annual: 671_040 }, pro: { monthly: 119_900, annual: 1_151_040 },
    iyzicoOnlinePaymentsAddOn: { monthly: 30_000, annual: 288_000 },
    checkoutAvailable: false,
    iyzicoOnlinePaymentsAddOnCheckoutAvailable: false,
  })
  assert.deepEqual(readBillingPlanPrices({
    ...complete,
    IYZICO_BILLING_MERCHANT_ID: undefined,
  }), {
    starter: { monthly: 34_900, annual: 335_040 }, plus: { monthly: 69_900, annual: 671_040 }, pro: { monthly: 119_900, annual: 1_151_040 },
    iyzicoOnlinePaymentsAddOn: { monthly: 30_000, annual: 288_000 },
    checkoutAvailable: false,
    iyzicoOnlinePaymentsAddOnCheckoutAvailable: false,
  })
})

test('canonical 300 TRY add-on price is independent from provider readiness', () => {
  const base = {
    SAAS_BILLING_ENABLED: 'true', IYZICO_BILLING_MERCHANT_ID: 'merchant',
    IYZICO_BILLING_API_KEY: 'api', IYZICO_BILLING_SECRET_KEY: 'secret',
    IYZICO_BILLING_BASE_URL: 'https://sandbox-api.iyzipay.com', INVOICE_VAT_RATE: '20',
    IYZICO_BILLING_STARTER_MONTHLY_PLAN_REF: 'starter-m', IYZICO_BILLING_STARTER_MONTHLY_AMOUNT_MINOR: '41880',
    IYZICO_BILLING_STARTER_ANNUAL_PLAN_REF: 'starter-a', IYZICO_BILLING_STARTER_ANNUAL_AMOUNT_MINOR: '402048',
    IYZICO_BILLING_PLUS_MONTHLY_PLAN_REF: 'plus-m', IYZICO_BILLING_PLUS_MONTHLY_AMOUNT_MINOR: '83880',
    IYZICO_BILLING_PLUS_ANNUAL_PLAN_REF: 'plus-a', IYZICO_BILLING_PLUS_ANNUAL_AMOUNT_MINOR: '805248',
    IYZICO_BILLING_PRO_MONTHLY_PLAN_REF: 'pro-m', IYZICO_BILLING_PRO_MONTHLY_AMOUNT_MINOR: '143880',
    IYZICO_BILLING_PRO_ANNUAL_PLAN_REF: 'pro-a', IYZICO_BILLING_PRO_ANNUAL_AMOUNT_MINOR: '1381248',
    IYZICO_BILLING_PRO_IYZICO_ADDON_MONTHLY_PLAN_REF: 'pro-addon-m',
    IYZICO_BILLING_PRO_IYZICO_ADDON_MONTHLY_ADDON_NET_AMOUNT_MINOR: '30000',
    IYZICO_BILLING_PRO_IYZICO_ADDON_MONTHLY_AMOUNT_MINOR: '179880',
    IYZICO_BILLING_PRO_IYZICO_ADDON_ANNUAL_PLAN_REF: 'pro-addon-a',
    IYZICO_BILLING_PRO_IYZICO_ADDON_ANNUAL_ADDON_NET_AMOUNT_MINOR: '288000',
    IYZICO_BILLING_PRO_IYZICO_ADDON_ANNUAL_AMOUNT_MINOR: '1726848',
  }
  assert.deepEqual(readBillingPlanPrices(base).iyzicoOnlinePaymentsAddOn, {
    monthly: 30_000, annual: 288_000,
  })
  assert.equal(readBillingPlanPrices(base).checkoutAvailable, true)
  assert.equal(readBillingPlanPrices(base).iyzicoOnlinePaymentsAddOnCheckoutAvailable, true)
  const partial = readBillingPlanPrices({
    ...base, IYZICO_BILLING_PRO_IYZICO_ADDON_ANNUAL_PLAN_REF: undefined,
  })
  assert.deepEqual(partial.iyzicoOnlinePaymentsAddOn, { monthly: 30_000, annual: 288_000 })
  assert.equal(partial.checkoutAvailable, false)
  assert.equal(partial.iyzicoOnlinePaymentsAddOnCheckoutAvailable, false)
  assert.equal(readBillingPlanPrices({
    ...base, IYZICO_BILLING_PRO_IYZICO_ADDON_MONTHLY_ADDON_NET_AMOUNT_MINOR: '20000',
  }).checkoutAvailable, false)
})
