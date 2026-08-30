import assert from 'node:assert/strict'
import test from 'node:test'
import {
  IYZICO_SUBSCRIPTION_PRODUCT_NAME,
  iyzicoSubscriptionProvisioningPlans,
} from './iyzico-subscription-provisioning'

test('provisioning builds one product with six immediate recurring monthly/annual plans', () => {
  const plans = iyzicoSubscriptionProvisioningPlans(20)
  assert.equal(IYZICO_SUBSCRIPTION_PRODUCT_NAME, 'Masabu SaaS Abonelik v1')
  assert.equal(plans.length, 6)
  assert.deepEqual(plans.map(({ plan, interval, amountMinor }) => ({ plan, interval, amountMinor })), [
    { plan: 'starter', interval: 'monthly', amountMinor: 41_880 },
    { plan: 'starter', interval: 'annual', amountMinor: 402_048 },
    { plan: 'plus', interval: 'monthly', amountMinor: 83_880 },
    { plan: 'plus', interval: 'annual', amountMinor: 805_248 },
    { plan: 'pro', interval: 'monthly', amountMinor: 143_880 },
    { plan: 'pro', interval: 'annual', amountMinor: 1_381_248 },
  ])
  assert.ok(plans.every(({ request }) => request.planPaymentType === 'RECURRING'))
  assert.ok(plans.every(({ request }) => !('trialPeriodDays' in request)))
  assert.ok(plans.every(({ request }) => !('recurrenceCount' in request)))
  assert.deepEqual(plans.filter(({ interval }) => interval === 'annual').map(({ request }) => (
    [request.paymentInterval, request.paymentIntervalCount]
  )), [['YEARLY', 1], ['YEARLY', 1], ['YEARLY', 1]])
})

test('provisioning rejects an invalid VAT rate before creating provider amounts', () => {
  assert.throws(() => iyzicoSubscriptionProvisioningPlans(20.5), /VAT rate/)
})
