import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { recordSecurityEvent, recordSignupLegalEvidence } from '@garsonless/db/server'
import { LEGAL_DOCUMENT_VERSION } from '@garsonless/domain/legal'
import { createDashboardServerClient } from '../../../lib/supabase-server'
import { parseForwardedIp } from '../../../lib/request-meta'
import { safeCallbackPath } from '../../../lib/auth/callback-path'

import { completeVerifiedSession } from '../../../lib/auth/flow-session'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeCallbackPath(searchParams.get('next'))

  if (next === '/auth/reset-password') {
    return NextResponse.redirect(origin + '/auth/login?mode=forgot&error=recovery_required')
  }
  if (code) {
    const supabase = await createDashboardServerClient({ authOnly: true })
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
      if (data.user && data.session && !await completeVerifiedSession(supabase, data.user, data.session.access_token)) {
        const query = new URLSearchParams({ email: data.user.email ?? '', next })
        return NextResponse.redirect(origin + '/auth/verify-email?' + query.toString())
      }
      const response = NextResponse.redirect(origin + next)
      response.headers.set('Cache-Control', 'private, no-store')

      return response
    }
  }

  return NextResponse.redirect(origin + '/auth/login?' + new URLSearchParams({ error: 'auth_callback_failed', next }).toString())
}
