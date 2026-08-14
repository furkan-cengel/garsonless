import 'server-only'
import { createClient } from '@garsonless/db/browser'
import { canRestaurantUseFeature } from '@garsonless/db/server'
import type { BillableFeature } from '@garsonless/domain/entitlements'

/** Public API routes resolve the tenant plan from the database and then use the
 * subscription-aware service boundary. Missing data or infrastructure errors
 * deny access; callers must never infer entitlement from client state. */
export async function publicRestaurantHasFeature(
  restaurantId: string,
  feature: BillableFeature,
): Promise<boolean> {
  const client = createClient()
  const { data, error } = await client
    .from('restaurants')
    .select('plan')
    .eq('id', restaurantId)
    .is('deleted_at', null)
    .maybeSingle()
  if (error || !data) return false
  return canRestaurantUseFeature({
    restaurantId,
    plan: (data as unknown as { plan: unknown }).plan,
    feature,
  })
}
