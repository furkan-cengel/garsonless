import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { recordSecurityEvent, recordSignupLegalEvidence } from '@garsonless/db/server'
import { LEGAL_DOCUMENT_VERSION } from '@garsonless/domain/legal'
import { createDashboardServerClient } from '../../../lib/supabase-server'
import { parseForwardedIp } from '../../../lib/request-meta'
import { safeCallbackPath } from '../../../lib/auth/callback-path'

const PASSWORD_RECOVERY_COOKIE = 'dashboard_password_recovery'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeCallbackPath(searchParams.get('next'))

  if (code) {
    const supabase = await createDashboardServerClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Best-effort security audit for magic-link / OAuth logins.
      if (data.user) {
        const ip = parseForwardedIp(request.headers.get('x-forwarded-for'), request.headers.get('x-real-ip'))
        await recordSecurityEvent({
          userId: data.user.id,
          eventType: 'login',
          ip,
          userAgent: request.headers.get('user-agent'),
        })
        const acceptedVersion = data.user.user_metadata?.['b2b_terms_version']
        const acceptedAt = data.user.user_metadata?.['b2b_terms_accepted_at']
        if (acceptedVersion === LEGAL_DOCUMENT_VERSION && typeof acceptedAt === 'string'
          && Number.isFinite(Date.parse(acceptedAt))) {
          await recordSignupLegalEvidence({
            userId: data.user.id, documentVersion: acceptedVersion,
            occurredAt: acceptedAt, ipHash: null,
            userAgent: request.headers.get('user-agent')?.slice(0, 500) ?? null,
          })
        }
      }
      const response = NextResponse.redirect(`${origin}${next}`)
      // A short-lived HttpOnly marker distinguishes the recovery link from a
      // normal authenticated visit. The reset form refuses to update a password
      // without it, while the Supabase code exchange remains the source of the
      // authenticated recovery session.
      if (next === '/auth/reset-password') {
        response.cookies.set(PASSWORD_RECOVERY_COOKIE, crypto.randomUUID(), {
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env['NODE_ENV'] === 'production',
          path: '/auth/reset-password',
          maxAge: 10 * 60,
        })
      }
      return response
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_callback_failed`)
}
