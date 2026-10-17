import { readEntryContext } from './lib/auth/entry-context'
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-masabu-request-path', req.nextUrl.pathname + req.nextUrl.search)
  const nextResponse = () => {
    requestHeaders.set('cookie', req.cookies.toString())
    return NextResponse.next({ request: { headers: requestHeaders } })
  }
  let supabaseResponse = nextResponse()

  const supabase = createServerClient(
    process.env['NEXT_PUBLIC_SUPABASE_URL']!,
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value))
          supabaseResponse = nextResponse()
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(
              name,
              value,
              options as Parameters<typeof supabaseResponse.cookies.set>[2],
            ),
          )
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // A redirect MUST carry over the cookies Supabase set on supabaseResponse while
  // getUser() refreshed the session. NextResponse.redirect() starts a fresh response,
  // so without this copy the rotated access/refresh token is dropped — the next
  // request reuses the now-invalid token, getUser() returns null, and the user is
  // bounced /dashboard → /auth/login → /dashboard → Pano (losing their place).
  // Documented Supabase SSR pitfall ("users randomly logged out / redirected").
  const redirectTo = (pathname: string, search?: string) => {
    const url = req.nextUrl.clone()
    url.pathname = pathname
    if (search !== undefined) url.search = search
    const res = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach((cookie) => res.cookies.set(cookie))
    return res
  }

  const signupEmailVerificationRequired =
    user?.app_metadata?.['dashboard_signup_email_verification_required'] === true
  const verificationProtectedPath = req.nextUrl.pathname === '/'
    || req.nextUrl.pathname === '/auth/signup'
    || req.nextUrl.pathname.startsWith('/dashboard') || req.nextUrl.pathname.startsWith('/sadakat')
  if (user && signupEmailVerificationRequired && verificationProtectedPath) {
    const verifySearch = new URLSearchParams({
      email: user.email ?? '',
      next: (req.nextUrl.pathname.startsWith('/dashboard') || req.nextUrl.pathname.startsWith('/sadakat'))
        ? `${req.nextUrl.pathname}${req.nextUrl.search}`
        : readEntryContext(Object.fromEntries(req.nextUrl.searchParams), true).next,
    })
    return redirectTo('/auth/verify-email', `?${verifySearch.toString()}`)
  }

  if (!user && (req.nextUrl.pathname.startsWith('/dashboard') || req.nextUrl.pathname.startsWith('/sadakat'))) {
    const loginSearch = new URLSearchParams({
      next: `${req.nextUrl.pathname}${req.nextUrl.search}`,
    })
    return redirectTo('/auth/login', `?${loginSearch.toString()}`)
  }

  // Keep login reachable even when the browser already has a session. This is
  // the account-switch escape hatch for an authenticated user with no
  // restaurant access; signInWithPassword replaces that session in place.
  if (user && req.nextUrl.pathname === '/auth/signup') {
    const target = new URL(readEntryContext(Object.fromEntries(req.nextUrl.searchParams), true).next, req.nextUrl.origin)
    return redirectTo(target.pathname, target.search)
  }

  if (user && req.nextUrl.pathname === '/') {
    return redirectTo('/dashboard')
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/', '/dashboard/:path*', '/sadakat/:path*', '/auth/:path*'],
}
