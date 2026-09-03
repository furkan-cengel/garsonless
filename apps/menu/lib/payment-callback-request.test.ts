import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MAX_PAYMENT_CALLBACK_BODY_BYTES,
  readBoundedPaymentCallbackToken,
} from './payment-callback-request.ts'

test('payment callback accepts one bounded provider token in either supported format', async () => {
  const form = await readBoundedPaymentCallbackToken(new Request('https://menu.masabu.co/api/payment/callback', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    body: 'token=provider-token-1',
  }))
  assert.deepEqual(form, { ok: true, token: 'provider-token-1' })

  const json = await readBoundedPaymentCallbackToken(new Request('https://menu.masabu.co/api/payment/callback', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: 'provider-token-2' }),
  }))
  assert.deepEqual(json, { ok: true, token: 'provider-token-2' })
})

test('payment callback rejects duplicate, malformed and unsupported token requests', async () => {
  const duplicate = await readBoundedPaymentCallbackToken(new Request('https://menu.masabu.co/api/payment/callback', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'token=one&token=two',
  }))
  assert.equal(duplicate.ok, false)
  if (!duplicate.ok) assert.equal(duplicate.status, 400)

  const malformed = await readBoundedPaymentCallbackToken(new Request('https://menu.masabu.co/api/payment/callback', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{',
  }))
  assert.equal(malformed.ok, false)
  if (!malformed.ok) assert.equal(malformed.status, 400)

  const unsupported = await readBoundedPaymentCallbackToken(new Request('https://menu.masabu.co/api/payment/callback', {
    method: 'POST',
    headers: { 'content-type': 'text/plain' },
    body: 'token=one',
  }))
  assert.equal(unsupported.ok, false)
  if (!unsupported.ok) assert.equal(unsupported.status, 415)
})

test('payment callback enforces declared and streamed byte ceilings', async () => {
  const declared = await readBoundedPaymentCallbackToken(new Request('https://menu.masabu.co/api/payment/callback', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'content-length': String(MAX_PAYMENT_CALLBACK_BODY_BYTES + 1),
    },
    body: '{}',
  }))
  assert.equal(declared.ok, false)
  if (!declared.ok) assert.equal(declared.status, 413)

  const streamed = await readBoundedPaymentCallbackToken(new Request('https://menu.masabu.co/api/payment/callback', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: `token=${'x'.repeat(MAX_PAYMENT_CALLBACK_BODY_BYTES)}`,
  }))
  assert.equal(streamed.ok, false)
  if (!streamed.ok) assert.equal(streamed.status, 413)
})
