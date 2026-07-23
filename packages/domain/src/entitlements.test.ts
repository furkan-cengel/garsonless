import assert from 'node:assert/strict'
import test from 'node:test'
import {
  BILLABLE_FEATURES,
  canUseEffectiveFeature,
  canUseFeature,
  getEffectiveFeatureEntitlement,
  getFeatureEntitlement,
  getPlanLimit,
  isWithinPlanLimit,
  normalizeRestaurantPlan,
  PLAN_DEFINITIONS,
  RESTAURANT_PLANS,
} from './entitlements'

test('plan catalogue has a closed, cumulative feature vocabulary', () => {
  for (const plan of RESTAURANT_PLANS) {
    for (const feature of PLAN_DEFINITIONS[plan].features) {
      assert.ok(BILLABLE_FEATURES.includes(feature))
    }
  }

  assert.equal(canUseFeature('free', 'qr_menu'), true)
  assert.equal(canUseFeature('free', 'theme_editor'), false)
  assert.equal(canUseFeature('starter', 'theme_editor'), true)
  assert.equal(canUseFeature('pro', 'kitchen_display'), true)
  assert.equal(canUseFeature('enterprise', 'sso'), true)
})

test('unknown and marketing-only plans fail closed to free while business maps to enterprise', () => {
  assert.equal(normalizeRestaurantPlan('unknown'), 'free')
  assert.equal(normalizeRestaurantPlan(undefined), 'free')
  assert.equal(normalizeRestaurantPlan('business'), 'enterprise')
  assert.deepEqual(getFeatureEntitlement('unknown', 'api_access'), {
    feature: 'api_access', plan: 'free', allowed: false, requiredPlan: 'enterprise',
  })
})

test('plan limits preserve unlimited enterprise and reject the next resource at a finite cap', () => {
  assert.equal(getPlanLimit('free', 'tables'), 3)
  assert.equal(isWithinPlanLimit('free', 'tables', 2), true)
  assert.equal(isWithinPlanLimit('free', 'tables', 3), false)
  assert.equal(getPlanLimit('enterprise', 'tables'), null)
  assert.equal(isWithinPlanLimit('enterprise', 'tables', 99_999), true)
})

test('an active allow override grants a plan-locked feature without mutating the plan', () => {
  const entitlement = getEffectiveFeatureEntitlement('free', 'loyalty', {
    feature: 'loyalty',
    decision: 'allow',
    expiresAt: '2026-07-24T12:00:00.000Z',
  }, new Date('2026-07-22T12:00:00.000Z'))

  assert.equal(entitlement.plan, 'free')
  assert.equal(entitlement.allowed, true)
  assert.equal(entitlement.source, 'override')
  assert.equal(entitlement.override?.decision, 'allow')
})

test('an active deny override temporarily blocks a feature already included in the plan', () => {
  assert.equal(canUseEffectiveFeature('enterprise', 'api_access', {
    feature: 'api_access',
    decision: 'deny',
    expiresAt: '2026-07-24T12:00:00.000Z',
  }, new Date('2026-07-22T12:00:00.000Z')), false)
})

test('expired, malformed and mismatched overrides fall back to the canonical plan', () => {
  const now = new Date('2026-07-22T12:00:00.000Z')
  assert.equal(canUseEffectiveFeature('free', 'loyalty', {
    feature: 'loyalty', decision: 'allow', expiresAt: '2026-07-22T11:59:59.000Z',
  }, now), false)
  assert.equal(canUseEffectiveFeature('free', 'loyalty', {
    feature: 'loyalty', decision: 'allow', expiresAt: 'not-a-date',
  }, now), false)
  assert.equal(canUseEffectiveFeature('pro', 'loyalty', {
    feature: 'kitchen_display', decision: 'deny', expiresAt: '2026-07-24T12:00:00.000Z',
  }, now), true)
})
