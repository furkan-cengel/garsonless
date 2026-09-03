'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@garsonless/db/types'
import { getPlatformAdminAuthCookieName } from './auth-cookie'

export function createPlatformAdminBrowserClient() {
  return createBrowserClient<Database>(
    process.env['NEXT_PUBLIC_SUPABASE_URL']!,
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!,
    {
      cookieOptions: { name: getPlatformAdminAuthCookieName() },
    },
  )
}
