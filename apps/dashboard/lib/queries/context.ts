import { cache } from 'react'
import type { DashboardActorContext, DashboardUserContext } from '@garsonless/domain'
import type { User } from '@supabase/supabase-js'
import { getUserRestaurantAccess } from '../auth/access'
import { createDashboardServerClient } from '../supabase-server'

export const getDashboardUserContext = cache(async function getDashboardUserContext(): Promise<DashboardUserContext | null> {
  const supabase = await createDashboardServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user ? { actor: 'dashboard-user', userId: user.id } : null
})

/** Auth data is resolved only at the Next adapter edge; query ports never
 * receive an untrusted browser-shaped user object. */
export const getDashboardAuthenticatedUser = cache(async function getDashboardAuthenticatedUser(): Promise<User | null> {
  const supabase = await createDashboardServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})

/** Resolves authentication and explicit owner/active-member authority at the
 * Next.js adapter edge. Application queries still re-check tenant + section. */
export const getDashboardFeatureContext = cache(async function getDashboardFeatureContext(
  restaurantId: string,
): Promise<DashboardActorContext | null> {
  const supabase = await createDashboardServerClient()
  const [{ data: { user } }, access] = await Promise.all([
    supabase.auth.getUser(),
    getUserRestaurantAccess(restaurantId),
  ])
  if (!user || !access) return null
  return {
    actor: 'dashboard-member',
    userId: user.id,
    restaurantId,
    permissions: access.permissions,
    isOwner: access.isOwner,
  }
})
