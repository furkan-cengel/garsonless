import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'
import { safeCallbackPath } from './auth/callback-path'
import { redirect } from 'next/navigation'
import { deviceContext, checkDeviceEvidence, deviceSecurityEnabled } from './auth/device-session'
import type { Database } from '@garsonless/db/types'

export async function createDashboardServerClient(options: { authOnly?: boolean } = {}) {
  const cookieStore = await cookies()
  const client = createServerClient<Database>(
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
  if (!options.authOnly && deviceSecurityEnabled()) {
    const context = await deviceContext(client)
    if (context && await checkDeviceEvidence(context)) {
      const next = safeCallbackPath((await headers()).get('x-masabu-request-path'))
      redirect('/auth/device-verification?' + new URLSearchParams({ next }).toString())
    }
  }
  return client
}
