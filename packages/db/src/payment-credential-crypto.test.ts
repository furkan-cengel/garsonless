import assert from 'node:assert/strict'
import test from 'node:test'
import {
  decryptPaymentCredentials,
  encryptPaymentCredentials,
  fingerprintPaymentCredentialWrite,
  loadPaymentCredentialKeyring,
  PaymentCredentialCryptoError,
} from './payment-credential-crypto'

const keyOne = Buffer.alloc(32, 0x11).toString('base64')
const keyTwo = Buffer.alloc(32, 0x22).toString('base64')

function keyring(activeVersion = 'key-2026-07') {
  return loadPaymentCredentialKeyring({
    PAYMENT_CREDENTIAL_ACTIVE_KEY_VERSION: activeVersion,
    PAYMENT_CREDENTIAL_ENCRYPTION_KEYS: JSON.stringify({
      'key-2026-07': keyOne,
      'key-2026-08': keyTwo,
    }),
  })
}

test('AES-256-GCM envelope round-trips without plaintext fields', () => {
  const ring = keyring()
  const envelope = encryptPaymentCredentials({
    restaurantId: 'restaurant-a',
    apiKey: 'api-key-sensitive',
    secretKey: 'secret-key-sensitive',
  }, ring)

  assert.equal(JSON.stringify(envelope).includes('api-key-sensitive'), false)
  assert.equal(JSON.stringify(envelope).includes('secret-key-sensitive'), false)
  assert.deepEqual(decryptPaymentCredentials(envelope, 'restaurant-a', ring), {
    apiKey: 'api-key-sensitive',
    secretKey: 'secret-key-sensitive',
    keyVersion: 'key-2026-07',
  })
})

test('tenant-bound AAD rejects cross-tenant envelope replay and tampering', () => {
  const ring = keyring()
  const envelope = encryptPaymentCredentials({
    restaurantId: 'restaurant-a',
    apiKey: 'api-key-sensitive',
    secretKey: 'secret-key-sensitive',
  }, ring)

  assert.throws(
    () => decryptPaymentCredentials(envelope, 'restaurant-b', ring),
    (error: unknown) => error instanceof PaymentCredentialCryptoError && error.code === 'DECRYPT_FAILED',
  )
  envelope.secretKeyCipher.ciphertext = Buffer.from('tampered').toString('base64')
  assert.throws(
    () => decryptPaymentCredentials(envelope, 'restaurant-a', ring),
    (error: unknown) => error instanceof PaymentCredentialCryptoError && error.code === 'DECRYPT_FAILED',
  )
})

test('old keys decrypt while new writes and fingerprints use the active version', () => {
  const oldRing = keyring('key-2026-07')
  const newRing = keyring('key-2026-08')
  const oldEnvelope = encryptPaymentCredentials({
    restaurantId: 'restaurant-a', apiKey: 'api-key-sensitive', secretKey: 'secret-key-sensitive',
  }, oldRing)

  assert.equal(decryptPaymentCredentials(oldEnvelope, 'restaurant-a', newRing).keyVersion, 'key-2026-07')
  assert.equal(encryptPaymentCredentials({
    restaurantId: 'restaurant-a', apiKey: 'api-key-sensitive', secretKey: 'secret-key-sensitive',
  }, newRing).keyVersion, 'key-2026-08')

  const input = {
    restaurantId: 'restaurant-a', provider: 'iyzico', mode: 'sandbox',
    apiKey: 'api-key-sensitive', secretKey: 'secret-key-sensitive',
  }
  assert.equal(fingerprintPaymentCredentialWrite(input, newRing), fingerprintPaymentCredentialWrite(input, newRing))
  assert.notEqual(fingerprintPaymentCredentialWrite(input, oldRing), fingerprintPaymentCredentialWrite(input, newRing))
})

test('keyring configuration rejects malformed and non-256-bit keys without echoing values', () => {
  assert.throws(
    () => loadPaymentCredentialKeyring({
      PAYMENT_CREDENTIAL_ACTIVE_KEY_VERSION: 'v1',
      PAYMENT_CREDENTIAL_ENCRYPTION_KEYS: JSON.stringify({ v1: Buffer.alloc(16).toString('base64') }),
    }),
    (error: unknown) => error instanceof PaymentCredentialCryptoError
      && error.code === 'CONFIG_INVALID'
      && !error.message.includes(Buffer.alloc(16).toString('base64')),
  )
})
