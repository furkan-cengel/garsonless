const _CUSTOMER_AUTH_ERROR_CODES = [
  'AUTH_REQUIRED',
  'SESSION_EXPIRED',
  'PROVIDER_DISABLED',
  'PLAN_REQUIRED',
  'OTP_INVALID',
  'OTP_EXPIRED',
  'RATE_LIMITED',
  'IDENTITY_CONFLICT',
  'STAFF_ACCOUNT_REJECTED',
  'CONTEXT_EXPIRED',
  'CONFLICT',
  'SERVICE_UNAVAILABLE',
] as const

export const CUSTOMER_AUTH_OAUTH_PROVIDERS = ['google', 'apple', 'facebook'] as const

export type CustomerAuthOAuthProvider = (typeof CUSTOMER_AUTH_OAUTH_PROVIDERS)[number]

export type CustomerAuthErrorCode = (typeof _CUSTOMER_AUTH_ERROR_CODES)[number]

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: CustomerAuthErrorCode; retryAfterSeconds?: number } }

interface VerifiedContactView {
  masked: string
  verified: boolean
}

export interface CustomerSessionView {
  authenticated: boolean
  profile: {
    name: string | null
    email: VerifiedContactView | null
    phone: VerifiedContactView | null
  } | null
  restaurant: {
    slug: string | null
  } | null
}

export function apiSuccess<T>(data: T): ApiResult<T> {
  return { ok: true, data }
}

export function apiFailure(
  code: CustomerAuthErrorCode,
  retryAfterSeconds?: number,
): ApiResult<never> {
  return retryAfterSeconds === undefined
    ? { ok: false, error: { code } }
    : { ok: false, error: { code, retryAfterSeconds } }
}

export function statusForCustomerAuthError(code: CustomerAuthErrorCode): number {
  switch (code) {
    case 'AUTH_REQUIRED': return 401
    case 'SESSION_EXPIRED': return 401
    case 'STAFF_ACCOUNT_REJECTED': return 403
    case 'PROVIDER_DISABLED': return 404
    case 'PLAN_REQUIRED': return 403
    case 'RATE_LIMITED': return 429
    case 'CONTEXT_EXPIRED': return 410
    case 'OTP_INVALID': return 400
    case 'OTP_EXPIRED': return 410
    case 'IDENTITY_CONFLICT': return 409
    case 'CONFLICT': return 409
    case 'SERVICE_UNAVAILABLE': return 503
  }
}

export function maskEmail(value: string): string {
  const [local = '', domain = ''] = value.split('@')
  if (!domain) return '***'
  const visible = local.slice(0, Math.min(2, local.length))
  return `${visible}${'*'.repeat(Math.max(3, local.length - visible.length))}@${domain}`
}

export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '')
  return digits.length < 4 ? '***' : `*** *** ${digits.slice(-4)}`
}
