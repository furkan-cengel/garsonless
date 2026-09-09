export const ANALYTICS_CONSENT_VERSION = '2026-09-09'
export const ANALYTICS_CONSENT_COOKIE = 'masabu_analytics_consent'
export const SIGNUP_RECEIPT_COOKIE = 'masabu_signup_receipt'
export const SIGNUP_PENDING_COOKIE = 'masabu_signup_pending'
export type AnalyticsConsent = 'granted' | 'denied' | 'unknown'
export type MarketingAnalyticsEvent =
  | { name: 'signup_click'; placement: 'header' | 'footer' | 'content' }
  | { name: 'generate_lead'; topic: 'general' | 'sales' }
  | { name: 'sign_up'; method: 'email' | 'google' }
  | { name: 'trial_started'; plan: 'starter' | 'plus' | 'pro' | 'business' }

export function parseAnalyticsConsent(value: string | undefined): AnalyticsConsent {
  if (value === `${ANALYTICS_CONSENT_VERSION}:granted`) return 'granted'
  if (value === `${ANALYTICS_CONSENT_VERSION}:denied`) return 'denied'
  return 'unknown'
}

export function validMeasurementId(value: string | undefined): string | null {
  return value && /^G-[A-Z0-9]{5,20}$/.test(value) ? value : null
}

export function analyticsPath(pathname: string, surface: 'marketing' | 'dashboard'): string | null {
  if (surface === 'dashboard') {
    return ['/auth/signup', '/auth/verify-email', '/auth/confirm', '/auth/terms', '/auth/complete', '/dashboard/onboarding'].includes(pathname) ? pathname : null
  }
  if (pathname === '/' || /^\/(qr-menu|dijital-adisyon|qr-siparis|mutfak-ekrani|fiyatlar|hakkimizda|iletisim|blog)$/.test(pathname)
    || /^\/blog\/[a-z0-9-]+$/.test(pathname) || /^\/yasal(?:\/[a-z0-9-]+)?$/.test(pathname)) return pathname
  return null
}

/** Never send query strings, fragments, credentials or unknown paths to GA. */
export function analyticsLocation(raw: string, surface: 'marketing' | 'dashboard'): string | null {
  try {
    const url = new URL(raw)
    const path = analyticsPath(url.pathname, surface)
    return path && ['https:', 'http:'].includes(url.protocol) ? url.origin + path : null
  } catch { return null }
}

export function analyticsReferrer(raw: string): string {
  try {
    const url = new URL(raw)
    if (!['https:', 'http:'].includes(url.protocol)) return ''
    // An origin suffices for acquisition; paths can contain account identifiers.
    return url.origin
  } catch { return '' }
}

export function analyticsCampaign(search: string): Record<string, string> {
  const params = new URLSearchParams(search)
  const fields: Record<string, string> = {}
  for (const key of ['source', 'medium', 'campaign', 'content', 'term'] as const) {
    const value = params.get(`utm_${key}`)
    // Campaign slugs only; reject email addresses, phone numbers and arbitrary text.
    if (value && /^[a-z][a-z0-9_-]{0,63}$/i.test(value) && !/\d{7}/.test(value)) {
      fields[key === 'campaign' ? 'campaign_name' : `campaign_${key}`] = value
    }
  }
  return fields
}

/** Auth-created metadata proves first email confirmation, not the URL's flow. */
export function isFreshSignup(user: { created_at: string; email_confirmed_at?: string; last_sign_in_at?: string }, startedAt?: number): boolean {
  const created = Date.parse(user.created_at)
  const confirmed = Date.parse(user.email_confirmed_at ?? '')
  const signedIn = Date.parse(user.last_sign_in_at ?? '')
  return Number.isFinite(created) && Number.isFinite(confirmed) && Number.isFinite(signedIn)
    && confirmed >= created && Math.abs(signedIn - confirmed) < 60_000
    && (startedAt === undefined || created >= startedAt - 5_000)
}
