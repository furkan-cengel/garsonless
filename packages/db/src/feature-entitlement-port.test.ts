import assert from 'node:assert/strict'
import test from 'node:test'
import {
  canRestaurantUseFeature,
  canRestaurantUseFeatures,
  resolveRestaurantFeatureEntitlement,
  type FeatureEntitlementRpc,
} from './feature-entitlement-port'

const restaurantId = '11111111-1111-4111-8111-111111111111'

test('runtime feature resolver combines the active override with the canonical plan', async () => {
  let received: unknown
  const rpc: FeatureEntitlementRpc = async (name, args) => {
    received = { name, args }
    return { data: { accessAllowed: true, override: { feature: 'loyalty', decision: 'allow', expiresAt: '2026-07-24T12:00:00.000Z' } }, error: null }
  }
  const result = await resolveRestaurantFeatureEntitlement({
    restaurantId, plan: 'free', feature: 'loyalty', now: new Date('2026-07-22T12:00:00.000Z'),
  }, rpc)
  assert.equal(result.ok && result.value.allowed, true)
  assert.equal(result.ok && result.value.source, 'override')
  assert.deepEqual(received, {
    name: 'read_restaurant_entitlement_context',
    args: { p_restaurant_id: restaurantId, p_feature: 'loyalty' },
  })
})

test('missing override uses the plan while an active deny can block it', async () => {
  const absent: FeatureEntitlementRpc = async () => ({ data: { accessAllowed: true, override: null }, error: null })
  assert.equal(await canRestaurantUseFeature({ restaurantId, plan: 'pro', feature: 'loyalty' }, absent), true)

  const denied: FeatureEntitlementRpc = async () => ({
    data: { accessAllowed: true, override: { feature: 'loyalty', decision: 'deny', expiresAt: '2099-01-01T00:00:00.000Z' } }, error: null,
  })
  assert.equal(await canRestaurantUseFeature({ restaurantId, plan: 'pro', feature: 'loyalty' }, denied), false)
})

test('RPC failure, malformed projection and invalid tenant fail closed', async () => {
  const failed: FeatureEntitlementRpc = async () => ({ data: null, error: { message: 'raw SQL detail' } })
  const malformed: FeatureEntitlementRpc = async () => ({ data: { accessAllowed: true, override: { feature: 'loyalty', decision: 'yes', expiresAt: 'tomorrow' } }, error: null })
  assert.equal(await canRestaurantUseFeature({ restaurantId, plan: 'business', feature: 'loyalty' }, failed), false)
  assert.equal(await canRestaurantUseFeature({ restaurantId, plan: 'business', feature: 'loyalty' }, malformed), false)
  assert.equal(await canRestaurantUseFeature({ restaurantId: 'forged', plan: 'business', feature: 'loyalty' }, failed), false)
})

test('expired or cancelled subscription status wins over plan and override access', async () => {
  const locked: FeatureEntitlementRpc = async () => ({
    data: { accessAllowed: false, override: { feature: 'loyalty', decision: 'allow', expiresAt: '2099-01-01T00:00:00.000Z' } },
    error: null,
  })
  assert.equal(await canRestaurantUseFeature({ restaurantId, plan: 'pro', feature: 'loyalty' }, locked), false)
})

test('online payments fail closed until paid add-on projection v1 is live', async () => {
  const legacy: FeatureEntitlementRpc = async () => ({
    data: { accessAllowed: true, override: null }, error: null,
  })
  assert.equal(await canRestaurantUseFeature({
    restaurantId, plan: 'pro', feature: 'online_payments',
  }, legacy), false)

  const addOnMissing: FeatureEntitlementRpc = async () => ({
    data: { accessAllowed: true, override: null, addOnEntitlementsVersion: 1, activeAddOns: [] }, error: null,
  })
  assert.equal(await canRestaurantUseFeature({
    restaurantId, plan: 'pro', feature: 'online_payments',
  }, addOnMissing), false)

  const addOnActive: FeatureEntitlementRpc = async () => ({
    data: {
      accessAllowed: true, override: null, addOnEntitlementsVersion: 1,
      activeAddOns: ['iyzico_online_payments'],
    }, error: null,
  })
  assert.equal(await canRestaurantUseFeature({
    restaurantId, plan: 'pro', feature: 'online_payments',
  }, addOnActive), true)
})

test('batched resolver uses one round trip and matches the single-feature rules', async () => {
  const calls: string[] = []
  const contexts = {
    loyalty: { accessAllowed: true, override: { feature: 'loyalty', decision: 'deny', expiresAt: '2099-01-01T00:00:00.000Z' } },
    kitchen_display: { accessAllowed: true, override: null },
    analytics_basic: { accessAllowed: true, override: null },
  }
  const rpc: FeatureEntitlementRpc = async (name, args) => {
    calls.push(name)
    if (name === 'read_restaurant_entitlement_contexts') {
      assert.deepEqual(args, { p_restaurant_id: restaurantId, p_features: ['loyalty', 'kitchen_display', 'analytics_basic'] })
      return { data: contexts, error: null }
    }
    return { data: contexts[args['p_feature'] as keyof typeof contexts], error: null }
  }
  const batched = await canRestaurantUseFeatures({ restaurantId, plan: 'pro', features: ['loyalty', 'kitchen_display', 'analytics_basic', 'loyalty'] }, rpc)
  assert.deepEqual(calls, ['read_restaurant_entitlement_contexts'])
  for (const feature of ['loyalty', 'kitchen_display', 'analytics_basic'] as const) {
    assert.equal(batched[feature], await canRestaurantUseFeature({ restaurantId, plan: 'pro', feature }, rpc), feature)
  }
  assert.equal(batched.loyalty, false)
  assert.equal(batched.analytics_basic, true)
})

test('batched resolver falls back per feature when the batch RPC is unavailable', async () => {
  const calls: string[] = []
  const rpc: FeatureEntitlementRpc = async (name) => {
    calls.push(name)
    return name === 'read_restaurant_entitlement_contexts'
      ? { data: null, error: { message: 'function does not exist' } }
      : { data: { accessAllowed: true, override: null }, error: null }
  }
  const result = await canRestaurantUseFeatures({ restaurantId, plan: 'pro', features: ['loyalty', 'analytics_basic'] }, rpc)
  assert.deepEqual(result, { loyalty: true, analytics_basic: true })
  assert.deepEqual(calls, ['read_restaurant_entitlement_contexts', 'read_restaurant_entitlement_context', 'read_restaurant_entitlement_context'])
})

test('batched resolver fails closed per feature and for an invalid tenant', async () => {
  const rpc: FeatureEntitlementRpc = async () => ({
    data: { loyalty: { accessAllowed: true, override: { feature: 'loyalty', decision: 'yes', expiresAt: 'x' } }, analytics_basic: { accessAllowed: true, override: null } },
    error: null,
  })
  assert.deepEqual(
    await canRestaurantUseFeatures({ restaurantId, plan: 'pro', features: ['loyalty', 'analytics_basic', 'kitchen_display'] }, rpc),
    { loyalty: false, analytics_basic: true, kitchen_display: false },
  )
  let touched = false
  const spy: FeatureEntitlementRpc = async () => { touched = true; return { data: {}, error: null } }
  assert.deepEqual(await canRestaurantUseFeatures({ restaurantId: 'forged', plan: 'pro', features: ['loyalty'] }, spy), { loyalty: false })
  assert.equal(touched, false)
})
