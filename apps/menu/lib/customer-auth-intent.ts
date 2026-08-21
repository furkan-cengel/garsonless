import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto'

export type CustomerAuthSurface = 'menu' | 'cart' | 'order' | 'bill' | 'split' | 'service'
export type CustomerAuthFlow = 'email' | 'oauth' | 'phone'

export interface CustomerAuthIntentV1 {
  version: 1
  keyVersion: string
  flow: CustomerAuthFlow
  nonce: string
  returnPath: string
  surface: CustomerAuthSurface
  restaurantId?: string
  restaurantSlug?: string
  tableId?: string
  qrToken?: string
  guestSessionId?: string
  deviceId?: string
  email?: string
  name?: string
  consent: boolean
  marketingConsent: boolean
  issuedAt: number
  expiresAt: number
}

export interface CustomerAuthIntentV2 {
  version: 2
  keyVersion: string
  flow: CustomerAuthFlow
  nonce: string
  returnPath: string
  surface: CustomerAuthSurface
  restaurantId?: string
  restaurantSlug?: string
  tableId?: string
  qrToken?: string
  guestSessionId?: string
  deviceId?: string
  email?: string
  phone?: string
  name?: string
  /** Legacy fields remain readable during the rollout, but no longer gate auth. */
  consent: boolean
  marketingConsent: boolean
  issuedAt: number
  expiresAt: number
}

export type CustomerAuthIntent = CustomerAuthIntentV1 | CustomerAuthIntentV2

interface CustomerAuthKeyring {
  active: string
  keys: Record<string, Buffer>
}

function readKeyring(raw = process.env['CUSTOMER_AUTH_STATE_KEYS']): CustomerAuthKeyring | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as { active?: unknown; keys?: unknown }
    if (typeof parsed.active !== 'string' || !parsed.keys || typeof parsed.keys !== 'object') return null
    const keys: Record<string, Buffer> = {}
    for (const [version, encoded] of Object.entries(parsed.keys as Record<string, unknown>)) {
      if (typeof encoded !== 'string') return null
      const key = Buffer.from(encoded, 'base64')
      if (key.length !== 32) return null
      keys[version] = key
    }
    return keys[parsed.active] ? { active: parsed.active, keys } : null
  } catch {
    return null
  }
}

export function createCustomerAuthNonce(): {
  value: string
  keyVersion: string
  hash: string
} | null {
  const keyring = readKeyring()
  if (!keyring) return null
  const value = randomBytes(32).toString('base64url')
  return {
    value,
    keyVersion: keyring.active,
    hash: createHmac('sha256', keyring.keys[keyring.active]!).update(value).digest('hex'),
  }
}

export function hashCustomerAuthValue(value: string, keyVersion?: string): string | null {
  const keyring = readKeyring()
  if (!keyring) return null
  const key = keyring.keys[keyVersion ?? keyring.active]
  return key ? createHmac('sha256', key).update(value).digest('hex') : null
}

export function summarizeCustomerAuthContext(intent: CustomerAuthIntent): string {
  return createHash('sha256').update(JSON.stringify({
    flow: intent.flow,
    returnPath: intent.returnPath,
    surface: intent.surface,
    restaurantId: intent.restaurantId ?? null,
    restaurantSlug: intent.restaurantSlug ?? null,
    tableId: intent.tableId ?? null,
    qrToken: intent.qrToken ?? null,
    guestSessionId: intent.guestSessionId ?? null,
    deviceId: intent.deviceId ?? null,
  })).digest('hex')
}

export function encryptCustomerAuthIntent(intent: CustomerAuthIntent): string | null {
  const keyring = readKeyring()
  const key = keyring?.keys[intent.keyVersion]
  if (!key) return null
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const format = intent.version === 2 ? 'v2' : 'v1'
  const aad = intent.version === 2
    ? `masabu-customer-auth-intent:v2:${intent.keyVersion}`
    : `masabu-customer-auth-intent:${intent.keyVersion}`
  cipher.setAAD(Buffer.from(aad))
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(intent), 'utf8'), cipher.final()])
  return [
    format,
    intent.keyVersion,
    iv.toString('base64url'),
    encrypted.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
  ].join('.')
}

export function decryptCustomerAuthIntent(value: string, now = Date.now()): CustomerAuthIntent | null {
  const keyring = readKeyring()
  const [format, version, ivValue, encryptedValue, tagValue, extra] = value.split('.')
  if (!keyring || (format !== 'v1' && format !== 'v2') || !version || !ivValue || !encryptedValue || !tagValue || extra) return null
  const key = keyring.keys[version]
  if (!key) return null
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivValue, 'base64url'))
    decipher.setAAD(Buffer.from(format === 'v2'
      ? `masabu-customer-auth-intent:v2:${version}`
      : `masabu-customer-auth-intent:${version}`))
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'))
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, 'base64url')),
      decipher.final(),
    ]).toString('utf8')
    const parsed = JSON.parse(plaintext) as CustomerAuthIntent
    const surfaces: ReadonlySet<string> = new Set(['menu', 'cart', 'order', 'bill', 'split', 'service'])
    if (
      parsed.version !== (format === 'v2' ? 2 : 1)
      || parsed.keyVersion !== version
      || (parsed.flow !== 'email' && parsed.flow !== 'oauth' && !(parsed.version === 2 && parsed.flow === 'phone'))
      || !surfaces.has(parsed.surface)
      || typeof parsed.nonce !== 'string'
      || typeof parsed.returnPath !== 'string'
      || typeof parsed.consent !== 'boolean'
      || typeof parsed.marketingConsent !== 'boolean'
      || typeof parsed.issuedAt !== 'number'
      || typeof parsed.expiresAt !== 'number'
      || (parsed.restaurantId !== undefined && typeof parsed.restaurantId !== 'string')
      || (parsed.restaurantSlug !== undefined && typeof parsed.restaurantSlug !== 'string')
      || (parsed.tableId !== undefined && typeof parsed.tableId !== 'string')
      || (parsed.qrToken !== undefined && typeof parsed.qrToken !== 'string')
      || (parsed.guestSessionId !== undefined && typeof parsed.guestSessionId !== 'string')
      || (parsed.deviceId !== undefined && typeof parsed.deviceId !== 'string')
      || (parsed.email !== undefined && typeof parsed.email !== 'string')
      || (parsed.version === 2 && parsed.phone !== undefined && typeof parsed.phone !== 'string')
      || parsed.expiresAt <= now
      || parsed.issuedAt > now + 30_000
    ) return null
    return parsed
  } catch {
    return null
  }
}

export function intentNonceMatches(intent: CustomerAuthIntent, supplied: string): boolean {
  const expected = Buffer.from(intent.nonce)
  const received = Buffer.from(supplied)
  return expected.length === received.length && timingSafeEqual(expected, received)
}
