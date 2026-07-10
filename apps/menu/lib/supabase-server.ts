import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@garsonless/db'

/**
 * CUSTOMER-auth server client (P2): reads the Supabase session cookies so SSR
 * pages and route handlers can resolve the signed-in customer via
 * `auth.getUser()`. Mirrors the dashboard's createDashboardServerClient
 * byte-for-byte (same getAll/setAll cookie bridge).
 *
 * NOT for data reads — menu data stays on the anon client (`lib/queries.ts`)
 * and privileged reads stay on the service role. This client is an IDENTITY
 * source only, per the locked P2 decision (no new RLS on customers).
 */
export async function createMenuServerClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env['NEXT_PUBLIC_SUPABASE_URL']!,
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2]),
            )
          } catch {
            // Called from a Server Component — cookie writes are expected to fail
          }
        },
      },
    },
  )
}
