import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const ENVELOPE_ALGORITHM = 'A256GCM'
const ENVELOPE_SCHEMA_VERSION = 1
const IV_BYTES = 12
const TAG_BYTES = 16
const KEY_BYTES = 32
const KEY_VERSION_PATTERN = /^[A-Za-z0-9._-]{1,64}$/
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/

const PAYMENT_CREDENTIAL_ACTIVE_KEY_VERSION_ENV = 'PAYMENT_CREDENTIAL_ACTIVE_KEY_VERSION'
const PAYMENT_CREDENTIAL_ENCRYPTION_KEYS_ENV = 'PAYMENT_CREDENTIAL_ENCRYPTION_KEYS'

type PaymentCredentialCiphertextV1 = {
  iv: string
  ciphertext: string
  tag: string
}

export type PaymentCredentialEnvelopeV1 = {
  schemaVersion: 1
  algorithm: 'A256GCM'
  keyVersion: string
  apiKeyCipher: PaymentCredentialCiphertextV1
  secretKeyCipher: PaymentCredentialCiphertextV1
}

export type PaymentCredentialKeyring = {
  activeVersion: string
  keys: ReadonlyMap<string, Buffer>
}

export class PaymentCredentialCryptoError extends Error {
  constructor(readonly code: 'CONFIG_INVALID' | 'ENVELOPE_INVALID' | 'KEY_UNAVAILABLE' | 'DECRYPT_FAILED') {
    super(`Payment credential crypto failure: ${code}`)
    this.name = 'PaymentCredentialCryptoError'
  }
}

function decodeKey(value: unknown): Buffer {
  if (typeof value !== 'string' || !BASE64_PATTERN.test(value)) {
    throw new PaymentCredentialCryptoError('CONFIG_INVALID')
  }
  const decoded = Buffer.from(value, 'base64')
  if (decoded.length !== KEY_BYTES) throw new PaymentCredentialCryptoError('CONFIG_INVALID')
  return decoded
}

export function loadPaymentCredentialKeyring(
  environment: NodeJS.ProcessEnv = process.env,
): PaymentCredentialKeyring {
  const activeVersion = environment[PAYMENT_CREDENTIAL_ACTIVE_KEY_VERSION_ENV]
  const serialized = environment[PAYMENT_CREDENTIAL_ENCRYPTION_KEYS_ENV]
  if (!activeVersion || !KEY_VERSION_PATTERN.test(activeVersion) || !serialized) {
    throw new PaymentCredentialCryptoError('CONFIG_INVALID')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(serialized)
  } catch {
    throw new PaymentCredentialCryptoError('CONFIG_INVALID')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new PaymentCredentialCryptoError('CONFIG_INVALID')
  }

  const entries = Object.entries(parsed as Record<string, unknown>)
  if (entries.length === 0) throw new PaymentCredentialCryptoError('CONFIG_INVALID')
  const keys = new Map<string, Buffer>()
  for (const [version, encoded] of entries) {
    if (!KEY_VERSION_PATTERN.test(version)) throw new PaymentCredentialCryptoError('CONFIG_INVALID')
    keys.set(version, decodeKey(encoded))
  }
  if (!keys.has(activeVersion)) throw new PaymentCredentialCryptoError('CONFIG_INVALID')
  return { activeVersion, keys }
}

function aad(restaurantId: string, field: 'api-key' | 'secret-key', keyVersion: string) {
  return Buffer.from(`payment-credentials:${ENVELOPE_SCHEMA_VERSION}:${restaurantId}:${field}:${keyVersion}`, 'utf8')
}

function encryptValue(value: string, key: Buffer, associatedData: Buffer): PaymentCredentialCiphertextV1 {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES })
  cipher.setAAD(associatedData)
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return {
    iv: iv.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
  }
}

export function encryptPaymentCredentials(
  input: { restaurantId: string; apiKey: string; secretKey: string },
  keyring: PaymentCredentialKeyring,
): PaymentCredentialEnvelopeV1 {
  const key = keyring.keys.get(keyring.activeVersion)
  if (!key) throw new PaymentCredentialCryptoError('KEY_UNAVAILABLE')
  return {
    schemaVersion: ENVELOPE_SCHEMA_VERSION,
    algorithm: ENVELOPE_ALGORITHM,
    keyVersion: keyring.activeVersion,
    apiKeyCipher: encryptValue(input.apiKey, key, aad(input.restaurantId, 'api-key', keyring.activeVersion)),
    secretKeyCipher: encryptValue(input.secretKey, key, aad(input.restaurantId, 'secret-key', keyring.activeVersion)),
  }
}

function parseCiphertext(value: unknown): PaymentCredentialCiphertextV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new PaymentCredentialCryptoError('ENVELOPE_INVALID')
  }
  const record = value as Record<string, unknown>
  const iv = record['iv']
  const ciphertext = record['ciphertext']
  const tag = record['tag']
  if (
    typeof iv !== 'string'
    || typeof ciphertext !== 'string'
    || typeof tag !== 'string'
    || !BASE64_PATTERN.test(iv)
    || !BASE64_PATTERN.test(ciphertext)
    || !BASE64_PATTERN.test(tag)
    || Buffer.from(iv, 'base64').length !== IV_BYTES
    || Buffer.from(tag, 'base64').length !== TAG_BYTES
    || Buffer.from(ciphertext, 'base64').length === 0
  ) throw new PaymentCredentialCryptoError('ENVELOPE_INVALID')
  return { iv, ciphertext, tag }
}

function parsePaymentCredentialEnvelope(value: unknown): PaymentCredentialEnvelopeV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new PaymentCredentialCryptoError('ENVELOPE_INVALID')
  }
  const record = value as Record<string, unknown>
  const keyVersion = record['keyVersion']
  if (
    record['schemaVersion'] !== ENVELOPE_SCHEMA_VERSION
    || record['algorithm'] !== ENVELOPE_ALGORITHM
    || typeof keyVersion !== 'string'
    || !KEY_VERSION_PATTERN.test(keyVersion)
  ) throw new PaymentCredentialCryptoError('ENVELOPE_INVALID')
  return {
    schemaVersion: ENVELOPE_SCHEMA_VERSION,
    algorithm: ENVELOPE_ALGORITHM,
    keyVersion,
    apiKeyCipher: parseCiphertext(record['apiKeyCipher']),
    secretKeyCipher: parseCiphertext(record['secretKeyCipher']),
  }
}

function decryptValue(value: PaymentCredentialCiphertextV1, key: Buffer, associatedData: Buffer): string {
  try {
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(value.iv, 'base64'), { authTagLength: TAG_BYTES })
    decipher.setAAD(associatedData)
    decipher.setAuthTag(Buffer.from(value.tag, 'base64'))
    return Buffer.concat([
      decipher.update(Buffer.from(value.ciphertext, 'base64')),
      decipher.final(),
    ]).toString('utf8')
  } catch {
    throw new PaymentCredentialCryptoError('DECRYPT_FAILED')
  }
}

export function decryptPaymentCredentials(
  envelopeValue: unknown,
  restaurantId: string,
  keyring: PaymentCredentialKeyring,
): { apiKey: string; secretKey: string; keyVersion: string } {
  const envelope = parsePaymentCredentialEnvelope(envelopeValue)
  const key = keyring.keys.get(envelope.keyVersion)
  if (!key) throw new PaymentCredentialCryptoError('KEY_UNAVAILABLE')
  return {
    apiKey: decryptValue(envelope.apiKeyCipher, key, aad(restaurantId, 'api-key', envelope.keyVersion)),
    secretKey: decryptValue(envelope.secretKeyCipher, key, aad(restaurantId, 'secret-key', envelope.keyVersion)),
    keyVersion: envelope.keyVersion,
  }
}

export function fingerprintPaymentCredentialWrite(
  input: { restaurantId: string; provider: string; mode: string; apiKey: string; secretKey: string },
  keyring: PaymentCredentialKeyring,
): string {
  const key = keyring.keys.get(keyring.activeVersion)
  if (!key) throw new PaymentCredentialCryptoError('KEY_UNAVAILABLE')
  const canonical = JSON.stringify([
    input.restaurantId,
    input.provider,
    input.mode,
    input.apiKey,
    input.secretKey,
    keyring.activeVersion,
  ])
  return createHmac('sha256', key).update(canonical, 'utf8').digest('hex')
}
