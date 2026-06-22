import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@garsonless/db'

export function createMenuBrowserClient() {
  return createBrowserClient<Database>(
    process.env['NEXT_PUBLIC_SUPABASE_URL']!,
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!,
  )
}
