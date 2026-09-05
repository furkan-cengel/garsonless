import { createServerClient } from '@supabase/ssr'
import type { Database } from '@garsonless/db/types'
import { cookies } from 'next/headers'
import { getPlatformAdminAuthCookieName } from './auth-cookie'

export async function createPlatformAdminServerClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env['NEXT_PUBLIC_SUPABASE_URL']!,
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!,
    {
      cookieOptions: { name: getPlatformAdminAuthCookieName() },
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(
              name,
              value,
              options as Parameters<typeof cookieStore.set>[2],
            ))
          } catch {
            // Server Components cannot write refreshed cookies; middleware does it.
          }
        },
      },
    },
  )
}
