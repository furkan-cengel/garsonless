import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  let supabaseResponse = NextResponse.next({ request: req })

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
          supabaseResponse = NextResponse.next({ request: req })
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
  const redirectTo = (pathname: string) => {
    const url = req.nextUrl.clone()
    url.pathname = pathname
    const res = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach((cookie) => res.cookies.set(cookie))
    return res
  }

  if (!user && req.nextUrl.pathname.startsWith('/dashboard')) {
    return redirectTo('/auth/login')
  }

  if (
    user &&
    (req.nextUrl.pathname === '/auth/login' || req.nextUrl.pathname === '/auth/signup')
  ) {
    return redirectTo('/dashboard')
  }

  if (user && req.nextUrl.pathname === '/') {
    return redirectTo('/dashboard')
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/', '/dashboard/:path*', '/auth/:path*'],
}
