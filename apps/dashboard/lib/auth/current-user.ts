import { cache } from 'react'
import type { User } from '@supabase/supabase-js'
import { createDashboardServerClient } from '../supabase-server'

/**
 * Resolve the authenticated dashboard user once per React server request.
 * Layouts, page gates and query adapters share this result instead of each
 * issuing their own Supabase auth round trip.
 */
export const getDashboardRequestAuth = cache(async function getDashboardRequestAuth() {
  const supabase = await createDashboardServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user: user as User | null }
})

export const getDashboardAuthenticatedUser = cache(async function getDashboardAuthenticatedUser(): Promise<User | null> {
  return (await getDashboardRequestAuth()).user
})
