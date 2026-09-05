import assert from 'node:assert/strict'
import test from 'node:test'
import {
  IYZICO_SUBSCRIPTION_PRODUCT_NAME,
  iyzicoSubscriptionProvisioningPlans,
  validateIyzicoProvisioningTarget,
} from './iyzico-subscription-provisioning'

test('provisioning builds base and every canonical add-on plan variant', () => {
  const plans = iyzicoSubscriptionProvisioningPlans(20)
  assert.equal(IYZICO_SUBSCRIPTION_PRODUCT_NAME, 'Masabu SaaS Abonelik v1')
  assert.equal(plans.length, 12)
  assert.deepEqual(plans.map(({ plan, addOns, interval, amountMinor }) => ({ plan, addOns, interval, amountMinor })), [
    { plan: 'starter', addOns: [], interval: 'monthly', amountMinor: 41_880 },
    { plan: 'starter', addOns: [], interval: 'annual', amountMinor: 402_048 },
    { plan: 'plus', addOns: [], interval: 'monthly', amountMinor: 83_880 },
    { plan: 'plus', addOns: [], interval: 'annual', amountMinor: 805_248 },
    { plan: 'pro', addOns: [], interval: 'monthly', amountMinor: 143_880 },
    { plan: 'pro', addOns: [], interval: 'annual', amountMinor: 1_381_248 },
    { plan: 'pro', addOns: ['iyzico_online_payments'], interval: 'monthly', amountMinor: 179_880 },
    { plan: 'pro', addOns: ['iyzico_online_payments'], interval: 'annual', amountMinor: 1_726_848 },
    { plan: 'starter', addOns: ['storefront_video_hero'], interval: 'monthly', amountMinor: 46_560 },
    { plan: 'starter', addOns: ['storefront_video_hero'], interval: 'annual', amountMinor: 446_976 },
    { plan: 'plus', addOns: ['storefront_video_hero'], interval: 'monthly', amountMinor: 88_560 },
    { plan: 'plus', addOns: ['storefront_video_hero'], interval: 'annual', amountMinor: 850_176 },
  ])
  assert.ok(plans.every(({ request }) => request.planPaymentType === 'RECURRING'))
  assert.ok(plans.every(({ request }) => !('trialPeriodDays' in request)))
  assert.ok(plans.every(({ request }) => !('recurrenceCount' in request)))
  assert.deepEqual(plans.filter(({ interval }) => interval === 'annual').map(({ request }) => (
    [request.paymentInterval, request.paymentIntervalCount]
  )), Array.from({ length: 6 }, () => ['YEARLY', 1]))
})

test('provisioning rejects an invalid VAT rate before creating provider amounts', () => {
  assert.throws(() => iyzicoSubscriptionProvisioningPlans(20.5), /VAT rate/)
})

test('provisioning keeps sandbox and live mutations explicitly separated', () => {
  assert.equal(validateIyzicoProvisioningTarget({
    target: 'sandbox', baseUrl: 'https://sandbox-api.iyzipay.com', apply: true, liveConfirmed: false,
  }), 'sandbox')
  assert.throws(() => validateIyzicoProvisioningTarget({
    target: 'sandbox', baseUrl: 'https://api.iyzipay.com', apply: true, liveConfirmed: false,
  }), /base_url_mismatch/)
  assert.throws(() => validateIyzicoProvisioningTarget({
    target: 'live', baseUrl: 'https://api.iyzipay.com', apply: true, liveConfirmed: false,
  }), /live_provisioning_confirmation_required/)
  assert.equal(validateIyzicoProvisioningTarget({
    target: 'live', baseUrl: 'https://api.iyzipay.com', apply: true, liveConfirmed: true,
  }), 'live')
})
