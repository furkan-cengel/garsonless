import assert from 'node:assert/strict'
import test from 'node:test'
import { createSignupMarker, verifySignupMarker } from './signup-analytics-receipt'

test('signup receipt binds the authenticated account and method without disclosing the account', () => {
  const marker = createSignupMarker('account-one', 'email', 'test-key')!
  assert.equal(marker.includes('account-one'), false)
  assert.equal(verifySignupMarker('account-one', marker, 'test-key'), 'email')
  assert.equal(verifySignupMarker('account-two', marker, 'test-key'), null)
  assert.equal(verifySignupMarker('account-one', marker.replace('email:', 'google:'), 'test-key'), null)
  assert.equal(verifySignupMarker('account-one', marker, 'changed-key'), null)
})

test('missing configuration and malformed receipts cannot produce conversions or throw', () => {
  assert.equal(createSignupMarker('account', 'google', undefined), null)
  for (const value of ['', 'google', 'google:0', 'email:' + 'x'.repeat(64), 'google:' + '0'.repeat(64) + ':extra']) {
    assert.equal(verifySignupMarker('account', value, 'key'), null)
  }
})
