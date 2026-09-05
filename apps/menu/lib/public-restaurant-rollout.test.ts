import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isMissingPublicRestaurantRpc,
  projectPublicRestaurantSettings,
  readPublicRestaurantWithRpcFallback,
} from './public-restaurant-rollout.ts'

test('restaurant RPC fallback recognizes only the missing-function condition', () => {
  assert.equal(isMissingPublicRestaurantRpc({ code: 'PGRST202', message: 'schema cache miss' }), true)
  assert.equal(isMissingPublicRestaurantRpc({
    code: 'unknown',
    message: 'Could not find the function public.read_public_restaurant_by_slug(p_slug) in the schema cache',
  }), true)
  assert.equal(isMissingPublicRestaurantRpc({ code: '42501', message: 'permission denied' }), false)
  assert.equal(isMissingPublicRestaurantRpc({ code: 'PGRST205', message: 'table missing from schema cache' }), false)
  assert.equal(isMissingPublicRestaurantRpc({ code: 'XX000', message: 'Could not find another function' }), false)
})

test('legacy restaurant settings are reduced to the database public allowlist', () => {
  assert.deepEqual(projectPublicRestaurantSettings({
    contact: {
      phone: '+90 555 000 00 00',
      website: 'https://example.com',
      internalNote: 'private',
    },
    hours: { monday: { open: '09:00', close: null } },
    loyalty: {
      stamp_enabled: true,
      reward_catalog: [{ itemId: 'coffee', pointCost: 100, internal: null }],
      privateMultiplier: 12,
    },
    address: 'Legacy address',
    phone: 123,
    iyzico: { apiKey: 'must-not-leak' },
    ownerEmail: 'private@example.com',
  }), {
    contact: { phone: '+90 555 000 00 00', website: 'https://example.com' },
    hours: { monday: { open: '09:00' } },
    loyalty: {
      stamp_enabled: true,
      reward_catalog: [{ itemId: 'coffee', pointCost: 100 }],
    },
    address: 'Legacy address',
  })
})

test('legacy base-table read runs only for a missing restaurant RPC', async () => {
  let fallbackCalls = 0
  const row = {
    id: 'restaurant-1',
    settings: { contact: { email: 'public@example.com', private: 'hidden' }, secret: true },
  }
  const result = await readPublicRestaurantWithRpcFallback(
    async () => ({ data: null, error: { code: 'PGRST202', message: 'missing' } }),
    async () => {
      fallbackCalls += 1
      return { data: row, error: null }
    },
  )
  assert.equal(fallbackCalls, 1)
  assert.equal(result.source, 'legacy-projection')
  assert.deepEqual(result.data?.settings, { contact: { email: 'public@example.com' } })

  const denied = await readPublicRestaurantWithRpcFallback(
    async () => ({ data: null, error: { code: '42501', message: 'permission denied' } }),
    async () => {
      fallbackCalls += 1
      return { data: row, error: null }
    },
  )
  assert.equal(fallbackCalls, 1)
  assert.equal(denied.source, 'rpc')
  assert.equal(denied.error?.code, '42501')
})
