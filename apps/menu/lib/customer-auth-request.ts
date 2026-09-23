import { safeReturnPath } from '@garsonless/domain/navigation'
import { apiFailure, type ApiResult } from './customer-auth-contract.ts'

export function configuredMenuOrigin(): string | null {
  const configured = process.env['NEXT_PUBLIC_MENU_URL']
  if (!configured) return null
  try {
    return new URL(configured).origin
  } catch {
    return null
  }
}

export function validateCustomerAuthMutation(request: Request): ApiResult<null> {
  const expectedOrigin = configuredMenuOrigin()
  const origin = request.headers.get('origin')
  const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
  const fetchSite = request.headers.get('sec-fetch-site')

  if (!expectedOrigin || origin !== expectedOrigin || contentType !== 'application/json') {
    return apiFailure('AUTH_REQUIRED')
  }
  if (fetchSite && fetchSite !== 'same-origin') return apiFailure('AUTH_REQUIRED')
  return { ok: true, data: null }
}

export function safeCustomerReturnPath(value: string | null | undefined): string {
  return safeReturnPath(value, '/')
}

export function customerAuthCallbackUrl(intent: string): URL | null {
  const origin = configuredMenuOrigin()
  if (!origin) return null
  const callback = new URL('/auth/callback', origin)
  callback.searchParams.set('intent', intent)
  return callback
}
