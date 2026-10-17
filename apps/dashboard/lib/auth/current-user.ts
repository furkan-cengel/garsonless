import { cache } from 'react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
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
  // Middleware may have authenticated an in-flight request before logout.
  // Re-check here so a late action/render never turns an expired session into
  // a missing-restaurant 404. Tenant/section denial still uses its own gates.
  if (!user) {
    const path = (await headers()).get('x-masabu-request-path') ?? ''
    const next = /^\/(?:dashboard|sadakat)(?:[/?]|$)/.test(path) ? path : '/dashboard'
    redirect('/auth/login?' + new URLSearchParams({ next }).toString())
  }
  return { supabase, user: user as User }
})

export const getDashboardAuthenticatedUser = cache(async function getDashboardAuthenticatedUser(): Promise<User | null> {
  return (await getDashboardRequestAuth()).user
})
