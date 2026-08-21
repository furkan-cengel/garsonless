import { cookies } from 'next/headers'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import type { User } from '@supabase/supabase-js'
import { ensureCustomerIdentity } from '@garsonless/application/customers'
import { CUSTOMER_LEGAL_DOCUMENT_VERSION } from '@garsonless/domain/legal'
import {
  consumeCustomerAuthIntent,
  consumeCustomerAuthRateLimit,
  createCustomerIdentityApplicationPort,
  claimActiveCustomerGuestOrders,
  registerCustomerAuthIntent,
  recordCustomerMembershipLegalEvidence,
} from '@garsonless/db/server'
import {
  apiFailure,
  apiSuccess,
  maskEmail,
  maskPhone,
  type ApiResult,
  type CustomerAuthErrorCode,
  type CustomerSessionView,
} from './customer-auth-contract'
import {
  CUSTOMER_AUTH_INTENT_COOKIE,
  CUSTOMER_AUTH_INTENT_TTL_SECONDS,
  customerAuthIntentCookieOptions,
} from './customer-auth-cookie'
import {
  createCustomerAuthNonce,
  decryptCustomerAuthIntent,
  encryptCustomerAuthIntent,
  hashCustomerAuthValue,
  intentNonceMatches,
  summarizeCustomerAuthContext,
  type CustomerAuthFlow,
  type CustomerAuthIntent,
  type CustomerAuthIntentV2,
  type CustomerAuthSurface,
} from './customer-auth-intent'
import { safeCustomerReturnPath } from './customer-auth-request'

export interface CustomerAuthContextInput {
  returnPath?: string
  surface?: CustomerAuthSurface
  restaurantId?: string
  restaurantSlug?: string
  tableId?: string
  qrToken?: string
  guestSessionId?: string
  deviceId?: string
  name?: string
  consent?: boolean
  marketingConsent?: boolean
}

const CUSTOMER_PHONE_OTP_TTL_SECONDS = 5 * 60
const CUSTOMER_AUTH_ATTEMPT_COOKIE = 'masabu_customer_auth_attempt'
const CUSTOMER_AUTH_ATTEMPT_TTL_SECONDS = 15 * 60

function safeTokenEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

/**
 * Returns a short-lived, signed anonymous attempt identifier. It is deliberately
 * unrelated to device characteristics and expires with the adaptive-risk window.
 */
export async function customerAuthAttemptSubject(): Promise<string | null> {
  const cookieStore = await cookies()
  const current = cookieStore.get(CUSTOMER_AUTH_ATTEMPT_COOKIE)?.value
  if (current) {
    const [attemptId, suppliedSignature, extra] = current.split('.')
    if (attemptId && suppliedSignature && !extra && /^[A-Za-z0-9_-]{24}$/.test(attemptId)) {
      const expectedSignature = hashCustomerAuthValue(`auth-attempt:${attemptId}`)
      if (expectedSignature && safeTokenEqual(suppliedSignature, expectedSignature)) return attemptId
    }
  }

  const attemptId = randomBytes(18).toString('base64url')
  const signature = hashCustomerAuthValue(`auth-attempt:${attemptId}`)
  if (!signature) return null
  cookieStore.set(CUSTOMER_AUTH_ATTEMPT_COOKIE, `${attemptId}.${signature}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: CUSTOMER_AUTH_ATTEMPT_TTL_SECONDS,
  })
  return attemptId
}

export async function beginCustomerAuthIntent(input: CustomerAuthContextInput & {
  flow: CustomerAuthFlow
  email?: string
  phone?: string
}): Promise<ApiResult<{ intent: string; value: CustomerAuthIntentV2 }>> {
  const now = Date.now()
  const nonceProof = createCustomerAuthNonce()
  if (!nonceProof) return apiFailure('SERVICE_UNAVAILABLE')
  const nonce = nonceProof.value
  const keyVersion = nonceProof.keyVersion
  const value: CustomerAuthIntentV2 = {
    version: 2,
    keyVersion,
    flow: input.flow,
    nonce,
    returnPath: safeCustomerReturnPath(input.returnPath),
    surface: input.surface ?? 'menu',
    consent: input.consent === true,
    marketingConsent: input.marketingConsent === true,
    issuedAt: now,
    expiresAt: now + (input.flow === 'phone'
      ? CUSTOMER_PHONE_OTP_TTL_SECONDS
      : CUSTOMER_AUTH_INTENT_TTL_SECONDS) * 1_000,
    ...(input.restaurantId ? { restaurantId: input.restaurantId } : {}),
    ...(input.restaurantSlug ? { restaurantSlug: input.restaurantSlug } : {}),
    ...(input.tableId ? { tableId: input.tableId } : {}),
    ...(input.qrToken ? { qrToken: input.qrToken } : {}),
    ...(input.guestSessionId ? { guestSessionId: input.guestSessionId } : {}),
    ...(input.deviceId ? { deviceId: input.deviceId } : {}),
    ...(input.email ? { email: input.email } : {}),
    ...(input.phone ? { phone: input.phone } : {}),
    ...(input.name?.trim() ? { name: input.name.trim() } : {}),
  }
  const encrypted = encryptCustomerAuthIntent(value)
  if (!encrypted) return apiFailure('SERVICE_UNAVAILABLE')

  const registered = await registerCustomerAuthIntent({
    nonceHash: nonceProof.hash,
    flow: input.flow,
    contextHash: summarizeCustomerAuthContext(value),
    expiresAt: new Date(value.expiresAt).toISOString(),
  }).catch(() => false)
  if (!registered) return apiFailure('SERVICE_UNAVAILABLE')

  const cookieStore = await cookies()
  cookieStore.set(CUSTOMER_AUTH_INTENT_COOKIE, encrypted, customerAuthIntentCookieOptions())
  return apiSuccess({ intent: nonce, value })
}

export async function readCustomerAuthIntent(suppliedNonce: string): Promise<CustomerAuthIntent | null> {
  const cookieStore = await cookies()
  const encrypted = cookieStore.get(CUSTOMER_AUTH_INTENT_COOKIE)?.value
  if (!encrypted) return null
  const intent = decryptCustomerAuthIntent(encrypted)
  return intent && intentNonceMatches(intent, suppliedNonce) ? intent : null
}

export async function consumeStoredCustomerAuthIntent(intent: CustomerAuthIntent): Promise<boolean> {
  const nonceHash = hashCustomerAuthValue(intent.nonce, intent.keyVersion)
  if (!nonceHash) return false
  return consumeCustomerAuthIntent({
    nonceHash,
    contextHash: summarizeCustomerAuthContext(intent),
  }).catch(() => false)
}

export async function clearCustomerAuthIntentCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(CUSTOMER_AUTH_INTENT_COOKIE, '', {
    ...customerAuthIntentCookieOptions(),
    maxAge: 0,
  })
}

export function requestClientAddress(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',', 1)[0]?.trim()
  return forwarded || request.headers.get('x-real-ip')?.trim() || 'unknown'
}

export function recordCustomerAuthMetric(input: {
  method: 'phone' | 'email' | 'google' | 'apple' | 'facebook'
  stage: 'start' | 'sent' | 'verified' | 'failed'
  result: 'success' | 'error'
  startedAt: number
  errorCode?: CustomerAuthErrorCode
}): void {
  console.info(JSON.stringify({
    event: `customer_auth.${input.stage}`,
    method: input.method,
    result: input.result,
    durationMs: Math.min(60_000, Math.max(0, Date.now() - input.startedAt)),
    ...(input.errorCode ? { errorCode: input.errorCode } : {}),
  }))
}

export async function enforceCustomerAuthRateLimit(input: {
  request: Request
  bucket: string
  subject: string
  limit: number
  windowSeconds: number
}): Promise<ApiResult<null>> {
  const subjectHash = hashCustomerAuthValue(`${input.bucket}:${input.subject}`)
  if (!subjectHash) return apiFailure('SERVICE_UNAVAILABLE')
  const consumed = await consumeCustomerAuthRateLimit({
    bucket: input.bucket,
    subjectHash,
    limit: input.limit,
    windowSeconds: input.windowSeconds,
  }).catch(() => null)
  if (!consumed) return apiFailure('SERVICE_UNAVAILABLE')
  return consumed.allowed
    ? apiSuccess(null)
    : apiFailure('RATE_LIMITED', consumed.retryAfterSeconds)
}

export async function completeCustomerIdentity(
  user: User,
  intent: CustomerAuthIntent,
): Promise<ApiResult<CustomerSessionView>> {
  const result = await ensureCustomerIdentity({
    authUserId: user.id,
    email: user.email_confirmed_at ? user.email ?? null : null,
    phone: user.phone_confirmed_at ? user.phone ?? null : null,
    userMetadata: user.user_metadata ?? {},
    appMetadata: user.app_metadata ?? {},
  }, {
    name: intent.name,
    restaurantId: intent.restaurantId,
    consent: intent.consent,
    marketingConsent: intent.marketingConsent,
  }, createCustomerIdentityApplicationPort())

  if (!result.ok) {
    const code: CustomerAuthErrorCode = result.code ?? 'SERVICE_UNAVAILABLE'
    return apiFailure(code)
  }
  if (
    intent.restaurantId
    && intent.qrToken
    && intent.guestSessionId
    && intent.deviceId
  ) {
    const deviceProofHash = hashCustomerAuthValue(`${intent.guestSessionId}:${intent.deviceId}`, intent.keyVersion)
    if (deviceProofHash) {
      try {
        await claimActiveCustomerGuestOrders({
          customerId: result.customer.id,
          restaurantId: intent.restaurantId,
          tableToken: intent.qrToken,
          guestSessionId: intent.guestSessionId,
          deviceProofHash,
        })
      } catch {
        // Identity remains valid; a transient continuity failure must not leak
        // table/customer identifiers or strand the freshly-created session.
        console.warn(JSON.stringify({ event: 'customer_guest_claim.failed' }))
      }
    }
  }
  return apiSuccess(customerSessionView(user, result.customer.name, intent.restaurantSlug ?? null))
}

export async function recordCustomerAuthLegalEvidence(
  request: Request,
  userId: string,
  intent: CustomerAuthIntent,
): Promise<void> {
  const addressHash = hashCustomerAuthValue(`legal-ip:${requestClientAddress(request)}`, intent.keyVersion)
  const result = await recordCustomerMembershipLegalEvidence({
    userId,
    documentVersion: CUSTOMER_LEGAL_DOCUMENT_VERSION,
    occurredAt: new Date().toISOString(),
    ipHash: addressHash,
    userAgent: request.headers.get('user-agent')?.slice(0, 500) ?? null,
    restaurantId: intent.restaurantId ?? null,
  }).catch(() => null)
  if (!result?.ok) console.warn(JSON.stringify({ event: 'customer_auth.legal_evidence_failed' }))
}

export function customerSessionView(
  user: User,
  name: string | null,
  restaurantSlug: string | null = null,
): CustomerSessionView {
  return {
    authenticated: true,
    profile: {
      name,
      email: user.email ? {
        masked: maskEmail(user.email),
        verified: Boolean(user.email_confirmed_at),
      } : null,
      phone: user.phone ? {
        masked: maskPhone(user.phone),
        verified: Boolean(user.phone_confirmed_at),
      } : null,
    },
    restaurant: restaurantSlug ? { slug: restaurantSlug } : null,
  }
}

export function anonymousCustomerSessionView(): CustomerSessionView {
  return { authenticated: false, profile: null, restaurant: null }
}
