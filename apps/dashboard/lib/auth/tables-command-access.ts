import { canRestaurantUseFeature, readTablesCommandAccessBundle } from '@garsonless/db/server'
import { assertAccess, assertRestaurantFeature, getUserRestaurantAccess } from './access'
import { getDashboardRequestAuth } from './current-user'

export async function resolveTablesCommandActor(
  restaurantId: string,
): Promise<{ userId: string } | { error: string }> {
  try {
    const { user } = await getDashboardRequestAuth()
    if (!user) return { error: 'Not authorized' }
    const bundle = await readTablesCommandAccessBundle({
      restaurantId,
      actorUserId: user.id,
    }, AbortSignal.timeout(8_000))
    if (!bundle) {
      const fallback = await assertAccess(restaurantId, 'tables')
      return 'error' in fallback ? fallback : { userId: fallback.userId }
    }
    if (!bundle.authorized) return { error: 'Not authorized' }
    const entitled = await canRestaurantUseFeature(
      { restaurantId, plan: bundle.plan, feature: 'table_management' },
      async () => ({ data: bundle.entitlementContext, error: null }),
    )
    return entitled ? { userId: user.id } : { error: 'Not authorized' }
  } catch {
    return { error: 'Not authorized' }
  }
}

/** Basic table directory and stable QR-token administration is a Starter
 * capability. Keep it separate from live table/session operations. */
export async function resolveTableQrCommandActor(
  restaurantId: string,
): Promise<{ userId: string } | { error: string }> {
  const access = await getUserRestaurantAccess(restaurantId)
  if (!access || (!access.isOwner && !access.permissions.includes('tables'))) {
    return { error: 'Not authorized' }
  }
  const entitlement = await assertRestaurantFeature(restaurantId, 'qr_studio')
  return 'error' in entitlement ? entitlement : { userId: access.userId }
}
