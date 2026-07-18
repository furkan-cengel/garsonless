import { randomUUID } from 'node:crypto'
import {
  patchRestaurantSettings,
  requestQrStands,
  type StandRequestNotificationPort,
} from '@garsonless/application/restaurants'
import { err, ok } from '@garsonless/domain'
import { createClient, createServiceClient } from '../src/client'
import {
  createRestaurantSettingsPort,
  createStandRequestPort,
} from '../src/restaurant-application-port'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const service = createServiceClient()
const suffix = randomUUID().slice(0, 8)
let restaurantId = ''

async function main() {
  let primaryError: unknown = null
  try {
    const { data: fixture, error: fixtureError } = await service.from('restaurants')
      .select('owner_id').eq('slug', 'test-cafe-b').single()
    if (fixtureError || !fixture?.owner_id) throw fixtureError ?? new Error('Fixture owner unavailable')

    const { data: restaurant, error: restaurantError } = await service.from('restaurants').insert({
      owner_id: fixture.owner_id,
      slug: `restaurant-port-${suffix}`,
      name: `Restaurant port ${suffix}`,
      settings: { runtimeMarker: suffix },
    }).select('id').single()
    if (restaurantError || !restaurant) throw restaurantError ?? new Error('Restaurant unavailable')
    restaurantId = restaurant.id

    const context = {
      actor: 'dashboard-member' as const,
      userId: fixture.owner_id,
      restaurantId,
      permissions: ['settings', 'tables'],
      isOwner: true,
    }
    const settingsPort = createRestaurantSettingsPort()
    const [storePatch, notificationPatch] = await Promise.all([
      patchRestaurantSettings(context, {
        restaurantId,
        patch: { store: { locale: 'tr-TR', marker: suffix } },
      }, settingsPort),
      patchRestaurantSettings(context, {
        restaurantId,
        patch: { notifications: { newOrderSound: true } },
      }, settingsPort),
    ])
    assert(storePatch.ok && notificationPatch.ok, 'Concurrent settings patches failed')

    const { data: settingsRow, error: settingsError } = await service.from('restaurants')
      .select('settings').eq('id', restaurantId).single()
    if (settingsError) throw settingsError
    const settings = settingsRow.settings as Record<string, unknown>
    assert(settings['runtimeMarker'] === suffix, 'Existing settings key was overwritten')
    assert((settings['store'] as Record<string, unknown>)?.['marker'] === suffix, 'Store patch missing')
    assert(
      (settings['notifications'] as Record<string, unknown>)?.['newOrderSound'] === true,
      'Notification patch missing',
    )

    let deliveries = 0
    const successNotification: StandRequestNotificationPort = {
      async send() { deliveries += 1; return ok(null) },
    }
    const standPort = createStandRequestPort()
    const request = {
      restaurantId,
      contactName: 'Runtime Contact',
      email: 'runtime@example.com',
      phone: '+905321234567',
      tableCount: 3,
      standType: 'basic' as const,
      notes: `runtime-${suffix}`,
    }
    const first = await requestQrStands(context, request, standPort, successNotification)
    const replay = await requestQrStands(context, request, standPort, successNotification)
    assert(first.ok, first.ok ? '' : first.error)
    assert(!replay.ok && replay.error.includes('10 dakika'), 'Stand request replay was not throttled')
    assert(deliveries === 1, 'Throttled stand request reached the notification provider')

    const { error: clearError } = await service.from('qr_stand_request_limits')
      .delete().eq('restaurant_id', restaurantId)
    if (clearError) throw clearError
    const deliveryFailure = await requestQrStands(context, request, standPort, {
      async send() { return err('Synthetic delivery failure') },
    })
    assert(!deliveryFailure.ok && deliveryFailure.error === 'Synthetic delivery failure', 'Delivery failure was lost')
    const { count: remainingClaims, error: countError } = await service
      .from('qr_stand_request_limits')
      .select('restaurant_id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
    if (countError) throw countError
    assert(remainingClaims === 0, 'Failed delivery left a throttle claim')

    const anonPatch = await createClient().rpc('patch_restaurant_settings_atomic', {
      p_restaurant_id: restaurantId,
      p_patch: { forged: true },
    })
    assert(anonPatch.error?.code === '42501', 'Anon could execute settings patch RPC')

    console.log(JSON.stringify({
      settings: {
        concurrentPatches: 2,
        existingKeyPreserved: true,
        storePreserved: true,
        notificationsPreserved: true,
      },
      stands: {
        firstDelivered: first.ok,
        replayThrottled: !replay.ok,
        providerCalls: deliveries,
        failedDeliveryReleasedClaim: remainingClaims === 0,
      },
      access: { anonSettingsRpc: anonPatch.error.code },
    }, null, 2))
  } catch (error) {
    primaryError = error
  }

  if (restaurantId) {
    const { error } = await service.from('restaurants').delete().eq('id', restaurantId)
    if (error) throw error
  }
  const marker = restaurantId || randomUUID()
  const [restaurants, claims] = await Promise.all([
    service.from('restaurants').select('id', { count: 'exact', head: true }).eq('id', marker),
    service.from('qr_stand_request_limits').select('restaurant_id', { count: 'exact', head: true }).eq('restaurant_id', marker),
  ])
  const cleanup = { restaurants: restaurants.count, claims: claims.count }
  console.log(JSON.stringify({ cleanup }))
  assert(Object.values(cleanup).every((count) => count === 0), 'Restaurant boundary runtime left orphan rows')
  if (primaryError) throw primaryError
}

void main()
