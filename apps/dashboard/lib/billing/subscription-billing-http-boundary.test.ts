import assert from 'node:assert/strict'
import test from 'node:test'
import {
  declaredBillingBodyTooLarge,
  isBillingCallbackMediaType,
  isBillingWebhookMediaType,
  parseBillingCallbackToken,
} from './subscription-billing-http-boundary'

test('billing HTTP media types are explicit while allowing charset parameters', () => {
  assert.equal(isBillingCallbackMediaType('application/x-www-form-urlencoded; charset=UTF-8'), true)
  assert.equal(isBillingCallbackMediaType('text/plain'), false)
  assert.equal(isBillingWebhookMediaType('application/json; charset=utf-8'), true)
  assert.equal(isBillingWebhookMediaType(null), false)
})

test('declared billing body length fails closed when malformed or over budget', () => {
  assert.equal(declaredBillingBodyTooLarge(null, 8), false)
  assert.equal(declaredBillingBodyTooLarge('8', 8), false)
  assert.equal(declaredBillingBodyTooLarge('9', 8), true)
  assert.equal(declaredBillingBodyTooLarge('not-a-number', 8), true)
})

test('checkout token parser rejects duplicates, invalid UTF-8, whitespace and controls', () => {
  const encode = (value: string) => new TextEncoder().encode(value)
  assert.equal(parseBillingCallbackToken(encode('token=checkout-token_1')), 'checkout-token_1')
  assert.equal(parseBillingCallbackToken(encode('token=one&token=two')), null)
  assert.equal(parseBillingCallbackToken(encode('token=contains+space')), null)
  assert.equal(parseBillingCallbackToken(new Uint8Array([0xff])), null)
  assert.equal(parseBillingCallbackToken(encode(`token=${'a'.repeat(201)}`)), null)
})
