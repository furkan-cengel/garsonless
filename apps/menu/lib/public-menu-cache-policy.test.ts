import assert from 'node:assert/strict'
import test from 'node:test'
import { PUBLIC_MENU_CACHE_SECONDS, publicMenuCacheKey } from './public-menu-cache-policy.ts'

test('public menu cache keys are tenant, resource and revision scoped', () => {
  assert.deepEqual(publicMenuCacheKey('items', 'restaurant-a', 41), [
    'public-menu-items-v2',
    'restaurant-a',
    '41',
  ])
  assert.notDeepEqual(
    publicMenuCacheKey('categories', 'restaurant-a', 41),
    publicMenuCacheKey('categories', 'restaurant-a', 42),
  )
  assert.equal(PUBLIC_MENU_CACHE_SECONDS, 300)
})
