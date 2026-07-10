import { NextResponse } from 'next/server'
import { createMenuServerClient } from '../../../../lib/supabase-server'

type ApiResponse =
  | { authenticated: true; email: string | null; userId: string }
  | { authenticated: false }

/**
 * Read-only session probe (P2 Faz 1): proves the @supabase/ssr server client
 * resolves the middleware-refreshed customer session in a route handler.
 * Returns identity ONLY (no customer/PII lookup — that's F3's
 * getCustomerSession). Also the F2/F3 verification harness's anchor.
 */
export async function GET(): Promise<NextResponse<ApiResponse>> {
  const supabase = await createMenuServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ authenticated: false })
  return NextResponse.json({ authenticated: true, email: user.email ?? null, userId: user.id })
}
