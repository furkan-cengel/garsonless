import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  DASHBOARD_SECTIONS,
  firstPermittedPath,
  normalizeDashboardPermissions,
} from './lib/auth/access-policy'
import { resolveSettingsSection } from './components/settings/settings-sections'

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
  const redirectTo = (pathname: string, search?: string) => {
    const url = req.nextUrl.clone()
    url.pathname = pathname
    if (search !== undefined) url.search = search
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

  const settingsRoute = /^\/dashboard\/([^/]+)\/settings$/.exec(req.nextUrl.pathname)
  if (user && settingsRoute) {
    const restaurantId = settingsRoute[1]!
    const [{ data: owned }, { data: membership }] = await Promise.all([
      supabase
        .from('restaurants')
        .select('id')
        .eq('id', restaurantId)
        .eq('owner_id', user.id)
        .is('deleted_at', null)
        .maybeSingle(),
      supabase
        .from('restaurant_members')
        .select('permissions')
        .eq('restaurant_id', restaurantId)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle(),
    ])

    const permissions = normalizeDashboardPermissions(membership?.permissions)
    const access = owned
      ? { isOwner: true, permissions: [...DASHBOARD_SECTIONS] }
      : membership
        ? { isOwner: false, permissions }
        : null

    // Resolve member authorization before any React Server Component starts
    // streaming. A page-level redirect here previously became a client redirect
    // instruction and could fail with a hook-order hydration exception.
    if (access && !access.isOwner && !access.permissions.includes('settings')) {
      return redirectTo(firstPermittedPath(restaurantId, access), '')
    }

    if (access) {
      const requestedSection = req.nextUrl.searchParams.get('section') ?? undefined
      const resolvedSection = resolveSettingsSection(requestedSection, access.isOwner)
      if (requestedSection && requestedSection !== resolvedSection) {
        const canonical = new URLSearchParams({ section: resolvedSection })
        if (resolvedSection === 'billing' && req.nextUrl.searchParams.get('checkout') === 'success') {
          canonical.set('checkout', 'success')
        }
        return redirectTo(req.nextUrl.pathname, `?${canonical.toString()}`)
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/', '/dashboard/:path*', '/auth/:path*'],
}
