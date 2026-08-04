import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { frameAncestorsDirective, resolveFrameAncestors } from './lib/frame-ancestors'
import { readMenuAuthCookies, writeMenuAuthCookie } from './lib/customer-auth-cookie'

/**
 * Customer-session token refresh (P2 Faz 1). `getUser()` validates the session
 * and, when the access token is stale, ROTATES it — the setAll bridge writes
 * the rotated cookies onto both the forwarded request and the response
 * (`supabaseResponse` discipline, carried over from the dashboard's
 * cookie-propagation-race fix). The menu middleware never redirects, so the
 * dashboard's redirectTo() cookie-copy variant isn't needed here — but the
 * response built inside setAll IS what must be returned, or rotated refresh
 * tokens get dropped and customers are silently logged out.
 *
 * No gating: every menu route stays publicly reachable (guests browse and
 * order without an account). This middleware only keeps a signed-in
 * customer's session fresh for SSR/route handlers.
 */
export async function middleware(req: NextRequest) {
  let supabaseResponse = NextResponse.next({ request: req })

  const supabase = createServerClient(
    process.env['NEXT_PUBLIC_SUPABASE_URL']!,
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!,
    {
      cookies: {
        getAll() {
          return readMenuAuthCookies(req.cookies.getAll())
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          const isolatedCookies = cookiesToSet.map(writeMenuAuthCookie)
          isolatedCookies.forEach(({ name, value }) => req.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request: req })
          isolatedCookies.forEach(({ name, value, options }) =>
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

  await supabase.auth.getUser()

  const isThemePreview = req.nextUrl.searchParams.get('preview') === '1'
    && (/^\/[^/]+\/menu$/.test(req.nextUrl.pathname) || /^\/theme-preview\/[^/]+$/.test(req.nextUrl.pathname))
  const frameAncestors = resolveFrameAncestors({
    isThemePreview,
    configuredOrigins: process.env['DASHBOARD_PREVIEW_ORIGINS'],
    isProduction: process.env.NODE_ENV === 'production',
  })
  supabaseResponse.headers.set(
    'Content-Security-Policy',
    frameAncestorsDirective(frameAncestors),
  )

  return supabaseResponse
}

export const config = {
  // Everything except Next internals and static assets (images, icons,
  // manifest, service worker, brand files).
  matcher: [
    '/((?!_next/static|_next/image|favicon|apple-touch-icon|android-chrome|site\\.webmanifest|brand/|og-image).*)',
  ],
}
