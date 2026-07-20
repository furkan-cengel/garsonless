import test from 'node:test'
import assert from 'node:assert/strict'
import { err, ok } from '@garsonless/domain'
import {
  reorderKitchenStations,
  rotateKitchenAccessCredential,
  type KitchenSettingsCommandPort,
} from './kitchen'

const owner = {
  actor: 'dashboard-member' as const,
  userId: 'owner-a',
  restaurantId: 'restaurant-a',
  permissions: ['settings'],
  isOwner: true,
}

function port(): KitchenSettingsCommandPort {
  return {
    reorderStations: async () => ok(null),
    rotateAccessCredential: async () => ok(null),
  }
}

test('kitchen station commands reject cross-tenant and non-owner actors', async () => {
  const base = port()
  assert.deepEqual(await reorderKitchenStations(owner, {
    restaurantId: 'restaurant-b', orderedIds: ['a'],
  }, base), err('Not authorized'))
  assert.deepEqual(await rotateKitchenAccessCredential({ ...owner, isOwner: false }, {
    restaurantId: 'restaurant-a',
  }, base), err('Not authorized'))
})

test('kitchen station reordering rejects duplicate and empty selections before persistence', async () => {
  const base = port()
  let calls = 0
  base.reorderStations = async () => {
    calls += 1
    return ok(null)
  }
  assert.equal((await reorderKitchenStations(owner, {
    restaurantId: 'restaurant-a', orderedIds: [],
  }, base)).ok, false)
  assert.equal((await reorderKitchenStations(owner, {
    restaurantId: 'restaurant-a', orderedIds: ['station-a', 'station-a'],
  }, base)).ok, false)
  assert.equal(calls, 0)
})

test('owner commands delegate the complete ordered station set and credential rotation', async () => {
  const base = port()
  let ordered: string[] | null = null
  let rotated = false
  base.reorderStations = async (input) => {
    ordered = input.orderedIds
    return ok(null)
  }
  base.rotateAccessCredential = async () => {
    rotated = true
    return ok(null)
  }
  assert.equal((await reorderKitchenStations(owner, {
    restaurantId: 'restaurant-a', orderedIds: ['station-b', 'station-a'],
  }, base)).ok, true)
  assert.deepEqual(ordered, ['station-b', 'station-a'])
  assert.equal((await rotateKitchenAccessCredential(owner, {
    restaurantId: 'restaurant-a',
  }, base)).ok, true)
  assert.equal(rotated, true)
})
