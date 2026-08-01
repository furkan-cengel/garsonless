import assert from 'node:assert/strict'
import test from 'node:test'
import { createHmac } from 'node:crypto'
import { normalizeIyzicoDecimal, verifyIyzicoResponseSignature } from './iyzico.ts'

test('iyzico response verification normalizes decimal trailing zeroes and checks HMAC', () => {
  assert.equal(normalizeIyzicoDecimal('10.500'), '10.5')
  assert.equal(normalizeIyzicoDecimal('10.00'), '10')
  assert.equal(normalizeIyzicoDecimal('invalid'), null)

  const parts = ['SUCCESS', 'payment', 'TRY', 'basket', 'conversation', '10.5', '10', 'token']
  const signature = createHmac('sha256', 'secret').update(parts.join(':')).digest('hex')
  assert.equal(verifyIyzicoResponseSignature('secret', parts, signature), true)
  assert.equal(verifyIyzicoResponseSignature('secret', [...parts, 'tampered'], signature), false)
})
