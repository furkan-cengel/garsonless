import { cookies } from 'next/headers'
import { createSignupMarker, verifySignupMarker } from './signup-analytics-receipt'
import { ANALYTICS_CONSENT_COOKIE, SIGNUP_RECEIPT_COOKIE, SIGNUP_PENDING_COOKIE, parseAnalyticsConsent, validMeasurementId } from '@garsonless/domain/marketing-analytics'

const PENDING = SIGNUP_PENDING_COOKIE
const options = { secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/' }

/** A pending receipt is created only by a successful, genuinely NEW signup. */
export async function markPendingSignup(userId: string, method: 'email' | 'google') {
  try {
    const jar = await cookies()
    if ((!validMeasurementId(process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID)
        && !(process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === 'true'))
      || parseAnalyticsConsent(jar.get(ANALYTICS_CONSENT_COOKIE)?.value) !== 'granted') return
    const marker = createSignupMarker(userId, method, process.env['SUPABASE_SERVICE_ROLE_KEY'])
    // Readable so withdrawal can erase it. The HMAC prevents forgery; this
    // marker contains no account ID and grants no authentication authority.
    if (marker) jar.set(PENDING, marker, { ...options, httpOnly: false, maxAge: 86400 })
  } catch { /* Optional measurement never changes authentication. */ }
}

/** Auth success consumes the server-signed marker once; no account ID reaches GA. */
export async function completeSignupAnalytics(userId: string) {
  try {
    const jar = await cookies()
    const pending = jar.get(PENDING)?.value
    if (!pending) return
    jar.set(PENDING, '', { ...options, httpOnly: false, maxAge: 0 })
    if (parseAnalyticsConsent(jar.get(ANALYTICS_CONSENT_COOKIE)?.value) !== 'granted') return
    const method = verifySignupMarker(userId, pending, process.env['SUPABASE_SERVICE_ROLE_KEY'])
    if (method) {
      jar.set(SIGNUP_RECEIPT_COOKIE, method, { ...options, httpOnly: false, maxAge: 60 })
    }
  } catch { /* Optional measurement never changes authentication. */ }
}
