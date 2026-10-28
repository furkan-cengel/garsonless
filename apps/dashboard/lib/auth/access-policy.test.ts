import assert from 'node:assert/strict'
import test from 'node:test'
import { firstPermittedPath, normalizeDashboardPermissions } from './access-policy'

test('dashboard permissions are closed to the known navigation set', () => {
  assert.deepEqual(
    normalizeDashboardPermissions(['settings', 'orders', 'owner', null, 'settings']),
    ['settings', 'orders', 'settings'],
  )
  assert.deepEqual(normalizeDashboardPermissions('settings'), [])
})

test('member landing route is deterministic and never selects a forbidden section', () => {
  const restaurantId = '11111111-1111-4111-8111-111111111111'
  assert.equal(firstPermittedPath(restaurantId, { isOwner: false, permissions: ['settings'] }), `/dashboard/${restaurantId}/settings`)
  assert.equal(firstPermittedPath(restaurantId, { isOwner: false, permissions: ['orders', 'settings'] }), `/dashboard/${restaurantId}/orders`)
  assert.equal(firstPermittedPath(restaurantId, { isOwner: true, permissions: [] }), `/dashboard/${restaurantId}`)
})

test('the cash permission is a Pano capability, never a landing route', () => {
  const restaurantId = '11111111-1111-4111-8111-111111111111'
  assert.deepEqual(normalizeDashboardPermissions(['orders', 'cash', 'nope']), ['orders', 'cash'])
  assert.equal(firstPermittedPath(restaurantId, { isOwner: false, permissions: ['cash', 'orders'] }), `/dashboard/${restaurantId}/orders`)
})
