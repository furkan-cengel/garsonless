import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { recordSecurityEvent } from '@garsonless/db/server'
import { createDashboardServerClient } from '../../../lib/supabase-server'
import { parseForwardedIp } from '../../../lib/request-meta'

const PASSWORD_RECOVERY_COOKIE = 'dashboard_password_recovery'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

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
