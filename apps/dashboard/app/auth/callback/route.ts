import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { recordSecurityEvent } from '@garsonless/db/server'
import { createDashboardServerClient } from '../../../lib/supabase-server'
import { parseForwardedIp } from '../../../lib/request-meta'

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
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_callback_failed`)
}
