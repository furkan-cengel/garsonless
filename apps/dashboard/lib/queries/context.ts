import { cache } from 'react'
import type { DashboardActorContext, DashboardUserContext } from '@garsonless/domain'
import { getUserRestaurantAccess } from '../auth/access'
import { getDashboardAuthenticatedUser } from '../auth/current-user'

export { getDashboardAuthenticatedUser } from '../auth/current-user'

export const getDashboardUserContext = cache(async function getDashboardUserContext(): Promise<DashboardUserContext | null> {
  const user = await getDashboardAuthenticatedUser()
  return user ? { actor: 'dashboard-user', userId: user.id } : null
})

/** Resolves authentication and explicit owner/active-member authority at the
 * Next.js adapter edge. Application queries still re-check tenant + section. */
export const getDashboardFeatureContext = cache(async function getDashboardFeatureContext(
  restaurantId: string,
): Promise<DashboardActorContext | null> {
  const access = await getUserRestaurantAccess(restaurantId)
  if (!access) return null
  return {
    actor: 'dashboard-member',
    userId: access.userId,
    restaurantId,
    permissions: access.permissions,
    isOwner: access.isOwner,
  }
})
