import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import test from 'node:test'
import {
  decryptCustomerAuthIntent,
  encryptCustomerAuthIntent,
  hashCustomerAuthValue,
  intentNonceMatches,
  type CustomerAuthIntentV1,
} from './customer-auth-intent.ts'

const previousKeys = process.env['CUSTOMER_AUTH_STATE_KEYS']

test.after(() => {
  if (previousKeys === undefined) delete process.env['CUSTOMER_AUTH_STATE_KEYS']
  else process.env['CUSTOMER_AUTH_STATE_KEYS'] = previousKeys
})

test('auth intent is encrypted, authenticated, expiring and nonce-bound', () => {
  const v2Key = randomBytes(32).toString('base64')
  process.env['CUSTOMER_AUTH_STATE_KEYS'] = JSON.stringify({
    active: 'v2',
    keys: { v2: v2Key },
  })
  const now = Date.now()
  const intent: CustomerAuthIntentV1 = {
    version: 1,
    keyVersion: 'v2',
    flow: 'oauth',
    nonce: 'opaque-nonce',
    returnPath: '/test-cafe?table=4#cart',
    surface: 'cart',
    restaurantId: '7d8b51fc-82bf-40e6-bf6d-7174cb32d897',
    name: 'Ada Lovelace',
    consent: true,
    marketingConsent: false,
    issuedAt: now,
    expiresAt: now + 600_000,
  }
  const encrypted = encryptCustomerAuthIntent(intent)
  assert.ok(encrypted)
  assert.doesNotMatch(encrypted, /Ada|test-cafe|7d8b51fc/)
  assert.deepEqual(decryptCustomerAuthIntent(encrypted, now), intent)
  assert.equal(intentNonceMatches(intent, 'opaque-nonce'), true)
  assert.equal(intentNonceMatches(intent, 'replayed-nonce'), false)
  assert.equal(decryptCustomerAuthIntent(encrypted, now + 600_001), null)
  const [format, version, iv, ciphertext, tag] = encrypted.split('.')
  assert.ok(format && version && iv && ciphertext && tag)
  const tamperIndex = Math.floor(ciphertext.length / 2)
  const tamperedCiphertext = `${ciphertext.slice(0, tamperIndex)}${ciphertext[tamperIndex] === 'A' ? 'B' : 'A'}${ciphertext.slice(tamperIndex + 1)}`
  const tampered = [format, version, iv, tamperedCiphertext, tag].join('.')
  assert.equal(decryptCustomerAuthIntent(tampered, now), null)
  const originalHash = hashCustomerAuthValue('member@example.com', 'v2')
  assert.match(originalHash ?? '', /^[0-9a-f]{64}$/)

  process.env['CUSTOMER_AUTH_STATE_KEYS'] = JSON.stringify({
    active: 'v3',
    keys: { v2: v2Key, v3: randomBytes(32).toString('base64') },
  })
  assert.deepEqual(decryptCustomerAuthIntent(encrypted, now), intent)
  assert.equal(hashCustomerAuthValue('member@example.com', 'v2'), originalHash)
})

test('auth intent fails closed when the keyring is missing or malformed', () => {
  delete process.env['CUSTOMER_AUTH_STATE_KEYS']
  assert.equal(encryptCustomerAuthIntent({} as CustomerAuthIntentV1), null)
  process.env['CUSTOMER_AUTH_STATE_KEYS'] = '{"active":"v1","keys":{"v1":"short"}}'
  assert.equal(hashCustomerAuthValue('value'), null)
})
