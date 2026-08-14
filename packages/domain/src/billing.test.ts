import assert from 'node:assert/strict'
import test from 'node:test'
import {
  BILLING_CURRENCY,
  canTransitionSubscriptionStatus,
  isSubscriptionStatus,
  isValidBillingDunningPolicy,
  parseBillingAmount,
} from './billing'

test('subscription lifecycle allows recovery but keeps cancellation terminal', () => {
  assert.equal(canTransitionSubscriptionStatus('active', 'past_due'), true)
  assert.equal(canTransitionSubscriptionStatus('past_due', 'active'), true)
  assert.equal(canTransitionSubscriptionStatus('grace_period', 'suspended'), true)
  assert.equal(canTransitionSubscriptionStatus('suspended', 'active'), true)
  assert.equal(canTransitionSubscriptionStatus('cancelled', 'active'), false)
  assert.equal(canTransitionSubscriptionStatus('active', 'suspended'), false)
  assert.equal(canTransitionSubscriptionStatus('trial', 'trial_expired'), true)
  assert.equal(canTransitionSubscriptionStatus('trial_expired', 'active'), true)
})

test('subscription status vocabulary fails closed', () => {
  assert.equal(isSubscriptionStatus('trial'), true)
  assert.equal(isSubscriptionStatus('trial_expired'), true)
  assert.equal(isSubscriptionStatus('manual_hold'), true)
  assert.equal(isSubscriptionStatus('enabled'), false)
  assert.equal(isSubscriptionStatus(null), false)
})

test('billing money uses safe non-negative TRY minor units', () => {
  assert.deepEqual(parseBillingAmount(14_990, BILLING_CURRENCY), { minor: 14_990, currency: 'TRY' })
  assert.equal(parseBillingAmount(1.5, BILLING_CURRENCY), null)
  assert.equal(parseBillingAmount(-1, BILLING_CURRENCY), null)
  assert.equal(parseBillingAmount(100, 'USD'), null)
})

test('dunning policy comes from storage and preserves warning order', () => {
  assert.equal(isValidBillingDunningPolicy({
    trialDays: 14,
    preDueReminderDays: 3,
    retryAfterDays: 1,
    secondWarningAfterDays: 3,
    finalWarningAfterDays: 7,
    suspendAfterDays: 14,
    cancelledRetentionDays: 90,
  }), true)
  assert.equal(isValidBillingDunningPolicy({
    trialDays: 14,
    preDueReminderDays: 3,
    retryAfterDays: 1,
    secondWarningAfterDays: 7,
    finalWarningAfterDays: 7,
    suspendAfterDays: 14,
    cancelledRetentionDays: 90,
  }), false)
  assert.equal(isValidBillingDunningPolicy({
    trialDays: 14,
    preDueReminderDays: 3,
    retryAfterDays: 3,
    secondWarningAfterDays: 3,
    finalWarningAfterDays: 7,
    suspendAfterDays: 14,
    cancelledRetentionDays: 90,
  }), false)
})
