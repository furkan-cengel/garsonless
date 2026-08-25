import { randomBytes } from 'node:crypto'
import type { KitchenSettingsCommandPort } from '@garsonless/application/kitchen'
import { err, normalizeRestaurantPlan, ok, type Result } from '@garsonless/domain'
import { createServiceClient } from './service-client'
import { canRestaurantUseFeature } from './feature-entitlement-port'

type KitchenSettingsRpc = (
  name: 'reorder_kitchen_stations',
  args: { p_restaurant_id: string; p_ordered_ids: string[] },
) => Promise<{ error: { message: string } | null }>

function kitchenRpc(): KitchenSettingsRpc {
  const service = createServiceClient()
  return service.rpc.bind(service) as unknown as KitchenSettingsRpc
}

function rotateToken(): string {
  // This secret only signs short-lived launch/session artifacts. It is never
  // sent to the browser and rotating it invalidates prior KDS sessions.
  return randomBytes(32).toString('base64url')
}

export function createKitchenSettingsCommandPort(): KitchenSettingsCommandPort {
  return {
    async readFeatureAccess(input) {
      const { data, error } = await createServiceClient()
        .from('restaurants')
        .select('plan')
        .eq('id', input.restaurantId)
        .maybeSingle()
      if (error) return err(error.message)
      if (!data) return err('Restaurant not found')
      return ok(await canRestaurantUseFeature({
        restaurantId: input.restaurantId,
        plan: normalizeRestaurantPlan((data as { plan: unknown }).plan),
        feature: input.feature,
      }))
    },

    async reorderStations(input): Promise<Result<null>> {
      const { error } = await kitchenRpc()('reorder_kitchen_stations', {
        p_restaurant_id: input.restaurantId,
        p_ordered_ids: input.orderedIds,
      })
      return error ? err(error.message) : ok(null)
    },

    async rotateAccessCredential(input): Promise<Result<null>> {
      const { error } = await createServiceClient()
        .from('kitchen_credentials')
        .upsert({
          restaurant_id: input.restaurantId,
          token: rotateToken(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'restaurant_id' })
      return error ? err(error.message) : ok(null)
    },
  }
}
