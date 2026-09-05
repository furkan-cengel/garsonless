import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getPlatformAdminAuthCookieName } from './lib/auth-cookie'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env['NEXT_PUBLIC_SUPABASE_URL']!,
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!,
    {
      cookieOptions: { name: getPlatformAdminAuthCookieName() },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(
            name,
            value,
            options as Parameters<typeof response.cookies.set>[2],
          ))
        },
      },
    },
  )
  const { data: { user } } = await supabase.auth.getUser()
  const publicPath = request.nextUrl.pathname === '/auth/login'
  if (!user && !publicPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    const redirectResponse = NextResponse.redirect(url)
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie))
    return redirectResponse
  }
  return response
}

export const config = { matcher: ['/', '/auth/:path*'] }
