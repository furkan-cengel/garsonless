import { createHmac, timingSafeEqual } from 'node:crypto'

const TOKEN_VERSION = 1
const CLOCK_SKEW_SECONDS = 30
export const THEME_PREVIEW_ACCESS_TTL_SECONDS = 4 * 60 * 60

interface ThemePreviewAccessPayload {
  v: number
  restaurantId: string
  slug: string
  issuedAt: number
  expiresAt: number
}

function signatureFor(encodedPayload: string, secret: string): Buffer {
  return createHmac('sha256', secret)
    .update(`masabu:theme-preview:${encodedPayload}`)
    .digest()
}

function isPayload(value: unknown): value is ThemePreviewAccessPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const payload = value as Record<string, unknown>
  return payload['v'] === TOKEN_VERSION
    && typeof payload['restaurantId'] === 'string'
    && typeof payload['slug'] === 'string'
    && typeof payload['issuedAt'] === 'number'
    && Number.isInteger(payload['issuedAt'])
    && typeof payload['expiresAt'] === 'number'
    && Number.isInteger(payload['expiresAt'])
}

export function resolveThemePreviewSigningSecret(
  env: Readonly<Record<string, string | undefined>> = process.env,
): string | null {
  const secret = env['THEME_PREVIEW_SIGNING_SECRET'] ?? env['SUPABASE_SERVICE_ROLE_KEY']
  return typeof secret === 'string' && secret.length >= 32 ? secret : null
}

export function createThemePreviewAccessToken(
  input: {
    restaurantId: string
    slug: string
    ttlSeconds?: number
    nowSeconds?: number
  },
  secret: string,
): string {
  if (secret.length < 32) throw new Error('Theme preview signing secret is missing')
  if (!input.restaurantId || input.restaurantId.length > 100 || !input.slug || input.slug.length > 160) {
    throw new Error('Theme preview token target is invalid')
  }
  const nowSeconds = input.nowSeconds ?? Math.floor(Date.now() / 1000)
  const ttlSeconds = input.ttlSeconds ?? THEME_PREVIEW_ACCESS_TTL_SECONDS
  if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0 || ttlSeconds > THEME_PREVIEW_ACCESS_TTL_SECONDS) {
    throw new Error('Theme preview token TTL is invalid')
  }
  const encodedPayload = Buffer.from(JSON.stringify({
    v: TOKEN_VERSION,
    restaurantId: input.restaurantId,
    slug: input.slug,
    issuedAt: nowSeconds,
    expiresAt: nowSeconds + ttlSeconds,
  } satisfies ThemePreviewAccessPayload), 'utf8').toString('base64url')
  return `${encodedPayload}.${signatureFor(encodedPayload, secret).toString('base64url')}`
}

export function verifyThemePreviewAccessToken(
  token: string | null | undefined,
  expected: { restaurantId: string; slug: string; nowSeconds?: number },
  secret: string | null,
): boolean {
  if (!token || token.length > 2_048 || !secret) return false
  const [encodedPayload, encodedSignature, extra] = token.split('.')
  if (!encodedPayload || !encodedSignature || extra) return false

  let suppliedSignature: Buffer
  let payload: unknown
  try {
    suppliedSignature = Buffer.from(encodedSignature, 'base64url')
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as unknown
  } catch {
    return false
  }

  const expectedSignature = signatureFor(encodedPayload, secret)
  if (suppliedSignature.length !== expectedSignature.length) return false
  if (!timingSafeEqual(suppliedSignature, expectedSignature)) return false
  if (!isPayload(payload)) return false

  const nowSeconds = expected.nowSeconds ?? Math.floor(Date.now() / 1000)
  return payload.restaurantId === expected.restaurantId
    && payload.slug === expected.slug
    && payload.issuedAt <= nowSeconds + CLOCK_SKEW_SECONDS
    && payload.expiresAt > payload.issuedAt
    && payload.expiresAt > nowSeconds
    && payload.expiresAt - payload.issuedAt <= THEME_PREVIEW_ACCESS_TTL_SECONDS
}
