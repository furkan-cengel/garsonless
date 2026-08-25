import type {
  RestaurantSettingsPatchPersistenceResult,
  RestaurantSettingsPort,
  StandRequestPort,
} from '@garsonless/application/restaurants'
import { err, ok } from '@garsonless/domain'
import { createServiceClient } from './service-client'
import type { Json } from './types.gen'

export function createRestaurantSettingsPort(): RestaurantSettingsPort {
  return {
    async patchSettings(input) {
      const service = createServiceClient()
      const rpc = service.rpc.bind(service) as unknown as (
        name: 'patch_restaurant_settings_cas',
        args: { p_restaurant_id: string; p_patch: Json; p_expected_settings: Json; p_request_id: string },
      ) => Promise<{ data: Json | null; error: { message: string } | null }>
      const { data, error } = await rpc('patch_restaurant_settings_cas', {
        p_restaurant_id: input.restaurantId,
        p_patch: input.patch as Json,
        p_expected_settings: input.expectedSettings as Json,
        p_request_id: input.requestId,
      })
      if (error) {
        if (error.message.includes('settings_patch_idempotency_conflict')) {
          return err('Settings request conflicts with an earlier attempt')
        }
        return err('Settings could not be saved')
      }
      if (!data || typeof data !== 'object' || Array.isArray(data)) return err('Settings response is invalid')
      const value = data as Record<string, unknown>
      const outcome = value['outcome']
      const settings = value['settings']
      const conflictKeys = value['conflictKeys']
      if (
        (outcome !== 'saved' && outcome !== 'conflict' && outcome !== 'not_found')
        || typeof value['idempotent'] !== 'boolean'
        || !settings || typeof settings !== 'object' || Array.isArray(settings)
        || !Array.isArray(conflictKeys) || !conflictKeys.every((key) => typeof key === 'string')
      ) return err('Settings response is invalid')
      return ok({
        outcome,
        idempotent: value['idempotent'],
        settings: settings as Record<string, unknown>,
        conflictKeys,
      } satisfies RestaurantSettingsPatchPersistenceResult)
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
