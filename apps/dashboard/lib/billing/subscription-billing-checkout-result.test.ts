import assert from 'node:assert/strict'
import test from 'node:test'
import {
  BILLING_CHECKOUT_RESULT_MESSAGE,
  createBillingCheckoutResultDocument,
  isBillingCheckoutResultMessage,
} from './subscription-billing-checkout-result'

test('checkout result document posts an allowlisted result to the configured dashboard origin', () => {
  const document = createBillingCheckoutResultDocument({
    dashboardOrigin: new URL('https://app.masabu.co'),
    returnUrl: new URL('https://app.masabu.co/dashboard/restaurant/settings?section=billing'),
    nonce: 'result-nonce',
    outcome: 'succeeded',
  })

  assert.match(document, /^<!doctype html>/i)
  assert.doesNotMatch(document, /localStorage|providerCheckoutRef|providerSubscriptionRef/i)
  assert.match(document, /frame-ancestors 'self'/)
  assert.match(document, /script-src 'nonce-result-nonce'/)
  assert.match(document, /window\.parent\.postMessage/)
  assert.match(document, /"masabu:billing-checkout-result"/)
  assert.match(document, /"succeeded"/)
  assert.match(document, /, "https:\/\/app\.masabu\.co"\)/)
  assert.match(document, /target="_top"/)
  assert.doesNotMatch(document, /postMessage\([^)]*, '\*'\)/)
})

test('checkout result validation rejects unknown outcomes and public codes', () => {
  assert.equal(isBillingCheckoutResultMessage({
    type: BILLING_CHECKOUT_RESULT_MESSAGE,
    outcome: 'incomplete',
    code: 'MAS-PAY-409',
  }), true)
  assert.equal(isBillingCheckoutResultMessage({
    type: BILLING_CHECKOUT_RESULT_MESSAGE,
    outcome: 'expired',
    code: 'MAS-PAY-409',
  }), true)
  assert.equal(isBillingCheckoutResultMessage({
    type: BILLING_CHECKOUT_RESULT_MESSAGE,
    outcome: 'pending',
    code: 'MAS-PAY-409',
  }), true)
  assert.equal(isBillingCheckoutResultMessage({
    type: BILLING_CHECKOUT_RESULT_MESSAGE,
    outcome: 'success',
  }), false)
  assert.equal(isBillingCheckoutResultMessage({
    type: BILLING_CHECKOUT_RESULT_MESSAGE,
    outcome: 'failed',
    code: 'PROVIDER-RAW-500',
  }), false)
})

test('checkout result document requires the return URL to stay on the dashboard origin', () => {
  assert.throws(() => createBillingCheckoutResultDocument({
    dashboardOrigin: new URL('https://app.masabu.co'),
    returnUrl: new URL('https://attacker.example/'),
    nonce: 'result-nonce',
    outcome: 'failed',
    code: 'MAS-VAL-001',
  }))
})
