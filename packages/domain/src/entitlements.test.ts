import assert from 'node:assert/strict'
import test from 'node:test'
import {
  BILLABLE_FEATURES,
  calculatePlanCharge,
  canUseEffectiveFeature,
  canUseFeature,
  getEffectiveFeatureEntitlement,
  getFeatureEntitlement,
  PLAN_DEFINITIONS,
  PLAN_PRICES,
  RESTAURANT_ADD_ONS,
  RESTAURANT_PLANS,
  SELF_SERVE_PLANS,
} from './entitlements'

test('plan order and feature catalogue are closed and cumulative', () => {
  assert.deepEqual(RESTAURANT_PLANS, ['starter', 'plus', 'pro', 'business'])
  assert.deepEqual(SELF_SERVE_PLANS, ['starter', 'plus', 'pro'])
  for (const plan of RESTAURANT_PLANS) {
    for (const feature of PLAN_DEFINITIONS[plan].features) {
      assert.ok(BILLABLE_FEATURES.includes(feature))
    }
  }
  for (let index = 1; index < RESTAURANT_PLANS.length; index += 1) {
    const lower = PLAN_DEFINITIONS[RESTAURANT_PLANS[index - 1]!].features
    const higher = PLAN_DEFINITIONS[RESTAURANT_PLANS[index]!].features
    assert.ok(lower.every((feature) => higher.includes(feature)))
  }
})

test('feature boundaries match Starter, Plus, Pro and Business positioning', () => {
  assert.equal(canUseFeature('starter', 'qr_menu'), true)
  assert.equal(canUseFeature('starter', 'staff_orders'), false)
  assert.equal(canUseFeature('plus', 'staff_orders'), true)
  assert.equal(canUseFeature('plus', 'guest_ordering'), false)
  assert.equal(canUseFeature('pro', 'guest_ordering'), true)
  assert.equal(canUseFeature('pro', 'multi_location'), false)
  assert.equal(canUseFeature('business', 'multi_location'), true)
  assert.deepEqual(RESTAURANT_ADD_ONS, ['iyzico_online_payments'])
  assert.equal(canUseFeature('pro', 'online_payments'), false)
  assert.equal(canUseFeature('plus', 'online_payments', ['iyzico_online_payments']), false)
  assert.equal(canUseFeature('pro', 'online_payments', ['iyzico_online_payments']), true)
  assert.equal(canUseFeature('business', 'online_payments', ['iyzico_online_payments']), true)
})

test('unknown plans fail closed while legacy values map to the new catalogue', () => {
  assert.equal(canUseFeature('unknown', 'qr_menu'), false)
  assert.equal(canUseFeature(undefined, 'qr_menu'), false)
  assert.equal(canUseFeature('free', 'qr_menu'), true)
  assert.equal(canUseFeature('enterprise', 'multi_location'), true)
  assert.deepEqual(getFeatureEntitlement('unknown', 'guest_ordering'), {
    feature: 'guest_ordering', plan: 'starter', allowed: false, requiredPlan: 'pro',
  })
})

test('annual catalogue prices exclude KDV and are exactly twenty percent below twelve monthly payments', () => {
  for (const plan of SELF_SERVE_PLANS) {
    const monthly = PLAN_PRICES[plan].monthly
    const annual = PLAN_PRICES[plan].annual
    assert.equal(monthly.currency, 'TRY')
    assert.equal(monthly.vatIncluded, false)
    assert.equal(annual.vatIncluded, false)
    assert.equal(annual.amountMinor * 5, monthly.amountMinor * 12 * 4)
  }
  assert.equal(PLAN_PRICES.starter.annual.amountMinor, 335_040)
  assert.equal(PLAN_PRICES.plus.annual.amountMinor, 671_040)
  assert.equal(PLAN_PRICES.pro.annual.amountMinor, 1_151_040)
  assert.deepEqual(calculatePlanCharge(PLAN_PRICES.pro.monthly, 20), {
    netAmountMinor: 119_900,
    vatAmountMinor: 23_980,
    totalAmountMinor: 143_880,
  })
  assert.throws(() => calculatePlanCharge(PLAN_PRICES.pro.monthly, 20.5), /VAT rate/)
})

test('an active allow override grants a plan-locked feature without mutating the plan', () => {
  const entitlement = getEffectiveFeatureEntitlement('starter', 'loyalty', {
    feature: 'loyalty', decision: 'allow', expiresAt: '2026-08-16T12:00:00.000Z',
  }, new Date('2026-08-14T12:00:00.000Z'))
  assert.equal(entitlement.plan, 'starter')
  assert.equal(entitlement.allowed, true)
  assert.equal(entitlement.source, 'override')
})

test('deny and expired overrides preserve fail-closed semantics', () => {
  assert.equal(canUseEffectiveFeature('pro', 'loyalty', {
    feature: 'loyalty', decision: 'deny', expiresAt: '2026-08-16T12:00:00.000Z',
  }, new Date('2026-08-14T12:00:00.000Z')), false)
  assert.equal(canUseEffectiveFeature('starter', 'loyalty', {
    feature: 'loyalty', decision: 'allow', expiresAt: '2026-08-13T12:00:00.000Z',
  }, new Date('2026-08-14T12:00:00.000Z')), false)
})
