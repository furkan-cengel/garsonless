import type {
  RestaurantSettingsPort,
  StandRequestPort,
} from '@garsonless/application/restaurants'
import { err, ok } from '@garsonless/domain'
import { createServiceClient } from './client'
import type { Json } from './types.gen'

export function createRestaurantSettingsPort(): RestaurantSettingsPort {
  return {
    async patchSettings(input) {
      const service = createServiceClient()
      const rpc = service.rpc.bind(service) as unknown as (
        name: 'patch_restaurant_settings_atomic',
        args: { p_restaurant_id: string; p_patch: Json },
      ) => Promise<{ data: boolean | null; error: { message: string } | null }>
      const { data, error } = await rpc('patch_restaurant_settings_atomic', {
        p_restaurant_id: input.restaurantId,
        p_patch: input.patch as Json,
      })
      if (error) return err(error.message)
      return ok(data ? 'updated' : 'not_found')
    },
  }
}

export function createStandRequestPort(): StandRequestPort {
  return {
    async readRestaurantName(restaurantId) {
      const { data, error } = await createServiceClient()
        .from('restaurants')
        .select('name')
        .eq('id', restaurantId)
        .is('deleted_at', null)
        .maybeSingle()
      if (error) return err(error.message)
      return ok(data?.name ?? null)
    },
    async claimSlot(input) {
      const { data, error } = await createServiceClient().rpc('claim_qr_stand_request_slot', {
        p_restaurant_id: input.restaurantId,
        p_requested_by: input.requestedBy,
        p_window_seconds: input.windowSeconds,
      })
      return error ? err('Talep sınırı kontrol edilemedi.') : ok(data)
    },
    async releaseSlot(input) {
      const { error } = await createServiceClient()
        .from('qr_stand_request_limits')
        .delete()
        .eq('restaurant_id', input.restaurantId)
        .eq('requested_by', input.requestedBy)
        .eq('last_requested_at', input.claimedAt)
      return error ? err(error.message) : ok(null)
    },
  }
}
