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

const requestId = '11111111-1111-4111-8111-111111111111'
const writeGuard = { expectedSettings: {}, requestId }

const saved = {
  outcome: 'saved' as const,
  idempotent: false,
  settings: { loyalty: { enabled: true } },
  conflictKeys: [],
}

function settingsPort(): RestaurantSettingsPort {
  return { async patchSettings() { return ok(saved) } }
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
  port.patchSettings = async () => { touched = true; return ok(saved) }

  assert.deepEqual(
    await patchRestaurantSettings(member, {
      restaurantId: 'restaurant-a',
      patch: { loyalty: { enabled: true } },
      ...writeGuard,
    }, port),
    err('Not authorized'),
  )
  assert.equal(touched, false)
  assert.deepEqual(
    await patchRestaurantSettings({ ...member, isOwner: true }, {
      restaurantId: 'restaurant-a',
      patch: { loyalty: { enabled: true } },
      ...writeGuard,
    }, port),
    ok(saved),
  )
  assert.equal(touched, true)
})

test('settings command rejects cross-tenant writes before persistence', async () => {
  let touched = false
  const port = settingsPort()
  port.patchSettings = async () => { touched = true; return ok(saved) }
  assert.deepEqual(
    await patchRestaurantSettings(member, {
      restaurantId: 'restaurant-b',
      patch: { store: { name: 'Forged' } },
      ...writeGuard,
    }, port),
    err('Not authorized'),
  )
  assert.equal(touched, false)
})

test('settings command forwards the expected snapshot and stable request id', async () => {
  let captured: Parameters<RestaurantSettingsPort['patchSettings']>[0] | null = null
  const port: RestaurantSettingsPort = {
    async patchSettings(input) {
      captured = input
      return ok({ ...saved, settings: input.patch })
    },
  }
  const input = {
    restaurantId: 'restaurant-a',
    patch: { contact: { city: 'Ankara' } },
    expectedSettings: { contact: { city: 'İstanbul' }, hours: { mon: { active: true } } },
    requestId,
  }
  const result = await patchRestaurantSettings(member, input, port)
  assert.deepEqual(captured, input)
  assert.deepEqual(result, ok({ ...saved, settings: input.patch }))
})

test('settings command exposes a same-section conflict without claiming success', async () => {
  const conflict = {
    outcome: 'conflict' as const,
    idempotent: false,
    settings: { contact: { city: 'İzmir' } },
    conflictKeys: ['contact'],
  }
  const result = await patchRestaurantSettings(member, {
    restaurantId: 'restaurant-a',
    patch: { contact: { city: 'Ankara' } },
    expectedSettings: { contact: { city: 'İstanbul' } },
    requestId,
  }, { async patchSettings() { return ok(conflict) } })
  assert.deepEqual(result, ok(conflict))
})

test('settings command rejects malformed request ids before persistence', async () => {
  let touched = false
  const result = await patchRestaurantSettings(member, {
    restaurantId: 'restaurant-a',
    patch: { contact: { city: 'Ankara' } },
    expectedSettings: {},
    requestId: 'not-a-uuid',
  }, { async patchSettings() { touched = true; return ok(saved) } })
  assert.deepEqual(result, err('Invalid settings request'))
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
