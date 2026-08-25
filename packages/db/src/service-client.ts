import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from './types.gen'

function requireServerEnv(key: 'NEXT_PUBLIC_SUPABASE_URL' | 'SUPABASE_SERVICE_ROLE_KEY'): string {
  const value = process.env[key]
  if (!value) throw new Error(`Missing environment variable: ${key}`)
  return value
}

/** Service-role client. This module must never be reachable from a browser graph. */
export function createServiceClient() {
  return createSupabaseClient<Database>(
    requireServerEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireServerEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}
