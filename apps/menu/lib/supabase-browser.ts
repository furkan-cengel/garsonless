'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@garsonless/db/types'

/**
 * CUSTOMER-auth browser client (P2): cookie-backed via @supabase/ssr, so a
 * session established client-side (email OTP verify / OAuth callback) is
 * visible to the middleware and SSR immediately.
 *
 * Deliberately SEPARATE from `createMenuBrowserClient` (lib/supabase.ts) —
 * that one is the plain anon client used by the realtime channels
 * (shares/splitorders/order/bill) and stays untouched.
 */
let cached: ReturnType<typeof createBrowserClient<Database>> | null = null

export function createMenuAuthBrowserClient() {
  if (cached) return cached
  cached = createBrowserClient<Database>(
    process.env['NEXT_PUBLIC_SUPABASE_URL']!,
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!,
  )
  return cached
}
