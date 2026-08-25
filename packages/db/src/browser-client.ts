import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from './types.gen'

function requirePublicEnv(key: 'NEXT_PUBLIC_SUPABASE_URL' | 'NEXT_PUBLIC_SUPABASE_ANON_KEY'): string {
  const value = process.env[key]
  if (!value) throw new Error(`Missing environment variable: ${key}`)
  return value
}

/** Anon-key client safe for browser bundles and public RLS projections. */
export function createClient() {
  return createSupabaseClient<Database>(
    requirePublicEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requirePublicEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  )
}
