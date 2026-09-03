import 'server-only'
import { canPublicRestaurantUseFeature } from '@garsonless/db/server'
import type { BillableFeature } from '@garsonless/domain/entitlements'

/** Public API routes resolve the tenant plan from the database and then use the
 * subscription-aware service boundary. Missing data or infrastructure errors
 * deny access; callers must never infer entitlement from client state. */
export async function publicRestaurantHasFeature(
  restaurantId: string,
  feature: BillableFeature,
): Promise<boolean> {
  return canPublicRestaurantUseFeature({ restaurantId, feature })
}
