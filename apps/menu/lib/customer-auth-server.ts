import { cookies } from 'next/headers'
import type { User } from '@supabase/supabase-js'
import { ensureCustomerIdentity } from '@garsonless/application/customers'
import {
  consumeCustomerAuthIntent,
  consumeCustomerAuthRateLimit,
  createCustomerIdentityApplicationPort,
  claimActiveCustomerGuestOrders,
  registerCustomerAuthIntent,
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
  type CustomerAuthIntentV1,
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

export async function beginCustomerAuthIntent(input: CustomerAuthContextInput & {
  flow: CustomerAuthFlow
  email?: string
}): Promise<ApiResult<{ intent: string; value: CustomerAuthIntentV1 }>> {
  const now = Date.now()
  const nonceProof = createCustomerAuthNonce()
  if (!nonceProof) return apiFailure('SERVICE_UNAVAILABLE')
  const nonce = nonceProof.value
  const keyVersion = nonceProof.keyVersion
  const value: CustomerAuthIntentV1 = {
    version: 1,
    keyVersion,
    flow: input.flow,
    nonce,
    returnPath: safeCustomerReturnPath(input.returnPath),
    surface: input.surface ?? 'menu',
    consent: input.consent === true,
    marketingConsent: input.marketingConsent === true,
    issuedAt: now,
    expiresAt: now + CUSTOMER_AUTH_INTENT_TTL_SECONDS * 1_000,
    ...(input.restaurantId ? { restaurantId: input.restaurantId } : {}),
    ...(input.restaurantSlug ? { restaurantSlug: input.restaurantSlug } : {}),
    ...(input.tableId ? { tableId: input.tableId } : {}),
    ...(input.qrToken ? { qrToken: input.qrToken } : {}),
    ...(input.guestSessionId ? { guestSessionId: input.guestSessionId } : {}),
    ...(input.deviceId ? { deviceId: input.deviceId } : {}),
    ...(input.email ? { email: input.email } : {}),
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

export async function readCustomerAuthIntent(suppliedNonce: string): Promise<CustomerAuthIntentV1 | null> {
  const cookieStore = await cookies()
  const encrypted = cookieStore.get(CUSTOMER_AUTH_INTENT_COOKIE)?.value
  if (!encrypted) return null
  const intent = decryptCustomerAuthIntent(encrypted)
  return intent && intentNonceMatches(intent, suppliedNonce) ? intent : null
}

export async function consumeStoredCustomerAuthIntent(intent: CustomerAuthIntentV1): Promise<boolean> {
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
  intent: CustomerAuthIntentV1,
): Promise<ApiResult<CustomerSessionView>> {
  const result = await ensureCustomerIdentity({
    authUserId: user.id,
    email: user.email ?? null,
    phone: user.phone ?? null,
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
