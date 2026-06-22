import { NextResponse } from 'next/server'
import { CUSTOMER_SESSION_COOKIE } from '@garsonless/db'

// Clears the member session cookie. No auth needed beyond holding the cookie.
// Mirrors the attributes used when issuing (verify-otp) with maxAge 0 so the
// browser actually drops it.
export async function POST(): Promise<NextResponse<{ ok: true }>> {
  const res = NextResponse.json<{ ok: true }>({ ok: true })
  res.cookies.set(CUSTOMER_SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
  return res
}
