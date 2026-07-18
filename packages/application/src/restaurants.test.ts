import assert from 'node:assert/strict'
import test from 'node:test'
import { err, ok } from '@garsonless/domain'
import {
  patchRestaurantSettings,
  requestQrStands,
  type RestaurantSettingsPort,
  type StandRequestPort,
} from './restaurants'

const member = {
  actor: 'dashboard-member' as const,
  userId: 'member-a',
  restaurantId: 'restaurant-a',
  permissions: ['settings', 'tables'],
}

function settingsPort(): RestaurantSettingsPort {
  return { async patchSettings() { return ok('updated') } }
}

function standPort(overrides: Partial<StandRequestPort> = {}): StandRequestPort {
  return {
    async readRestaurantName() { return ok('Cafe A') },
    async claimSlot() { return ok('2026-07-17T12:00:00.000Z') },
    async releaseSlot() { return ok(null) },
    ...overrides,
  }
}

test('member settings are fail-closed while owners can patch owner-only keys', async () => {
  let touched = false
  const port = settingsPort()
  port.patchSettings = async () => { touched = true; return ok('updated') }

  assert.deepEqual(
    await patchRestaurantSettings(member, {
      restaurantId: 'restaurant-a',
      patch: { loyalty: { enabled: true } },
    }, port),
    err('Not authorized'),
  )
  assert.equal(touched, false)
  assert.deepEqual(
    await patchRestaurantSettings({ ...member, isOwner: true }, {
      restaurantId: 'restaurant-a',
      patch: { loyalty: { enabled: true } },
    }, port),
    ok(null),
  )
  assert.equal(touched, true)
})

test('settings command rejects cross-tenant writes before persistence', async () => {
  let touched = false
  const port = settingsPort()
  port.patchSettings = async () => { touched = true; return ok('updated') }
  assert.deepEqual(
    await patchRestaurantSettings(member, {
      restaurantId: 'restaurant-b',
      patch: { store: { name: 'Forged' } },
    }, port),
    err('Not authorized'),
  )
  assert.equal(touched, false)
})

test('stand request derives throttle actor and releases the slot when delivery fails', async () => {
  let claimedBy = ''
  let released = false
  const port = standPort({
    async claimSlot(input) {
      claimedBy = input.requestedBy
      return ok('2026-07-17T12:00:00.000Z')
    },
    async releaseSlot() {
      released = true
      return ok(null)
    },
  })
  const result = await requestQrStands(member, {
    restaurantId: 'restaurant-a',
    contactName: 'Ada',
    email: 'ada@example.com',
    phone: '+905321234567',
    tableCount: 3,
    standType: 'basic',
  }, port, { async send() { return err('Delivery unavailable') } })
  assert.deepEqual(result, err('Delivery unavailable'))
  assert.equal(claimedBy, 'member-a')
  assert.equal(released, true)
})

test('stand request throttles replay and never calls the provider', async () => {
  let sent = false
  const result = await requestQrStands(member, {
    restaurantId: 'restaurant-a',
    contactName: 'Ada',
    email: 'ada@example.com',
    phone: '+905321234567',
    tableCount: 3,
    standType: 'premium',
  }, standPort({ async claimSlot() { return ok(null) } }), {
    async send() { sent = true; return ok(null) },
  })
  assert.deepEqual(result, err('Yeni bir talep göndermek için 10 dakika bekleyin.'))
  assert.equal(sent, false)
})
