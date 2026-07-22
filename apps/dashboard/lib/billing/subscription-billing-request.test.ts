import assert from 'node:assert/strict'
import test from 'node:test'
import {
  billingCheckoutCallbackUrl,
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
    requestId: '11111111-1111-4111-8111-111111111111', plan: 'pro',
    profile: {
      legalName: ' Masabu Test AŞ ', name: 'Masabu', surname: 'Test',
      identityNumber: '11111111111', email: 'OWNER@EXAMPLE.COM',
      gsmNumber: '+90 (555) 111 22 33', billingAddress: address, shippingAddress: address,
    },
  })
  assert.equal(parsed.profile.legalName, 'Masabu Test AŞ')
  assert.equal(parsed.profile.email, 'owner@example.com')
  assert.equal(parsed.profile.gsmNumber, '+905551112233')
  assert.equal(checkoutRequestSchema.safeParse({ ...parsed, plan: 'free' }).success, false)
  assert.equal(checkoutRequestSchema.safeParse({
    ...parsed, profile: { ...parsed.profile, identityNumber: '123' },
  }).success, false)
})

test('billing request fingerprint is deterministic and changes with immutable intent', () => {
  const left = requestFingerprint({ restaurantId: 'r1', plan: 'pro' })
  const replay = requestFingerprint({ restaurantId: 'r1', plan: 'pro' })
  const changed = requestFingerprint({ restaurantId: 'r1', plan: 'starter' })
  assert.equal(left, replay)
  assert.notEqual(left, changed)
  assert.match(left, /^[a-f0-9]{64}$/)
})

test('monthly period clamps end-of-month and callback URL is origin constrained', () => {
  assert.deepEqual(billingPeriod(new Date('2026-01-31T10:00:00.000Z')), {
    periodStart: '2026-01-31T10:00:00.000Z',
    periodEnd: '2026-02-28T10:00:00.000Z',
    dueAt: '2026-01-31T10:00:00.000Z',
  })
  assert.equal(
    billingCheckoutCallbackUrl('https://dashboard.masabu.co'),
    'https://dashboard.masabu.co/api/billing/iyzico/checkout/callback',
  )
  assert.throws(() => billingCheckoutCallbackUrl('http://dashboard.example.com'), /origin is invalid/)
})

test('public billing plan prices expose only positive integer minor units', () => {
  assert.deepEqual(readBillingPlanPrices({
    IYZICO_BILLING_STARTER_AMOUNT_MINOR: '14990',
    IYZICO_BILLING_PRO_AMOUNT_MINOR: '29.99',
    IYZICO_BILLING_ENTERPRISE_AMOUNT_MINOR: '-1',
    IYZICO_BILLING_SECRET_KEY: 'never-return-this',
  }), { starter: 14990, pro: null, enterprise: null })
})
