import assert from 'node:assert/strict'
import test from 'node:test'
import {
  BILLABLE_FEATURES,
  canUseFeature,
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
