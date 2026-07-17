import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  DEFAULT_TIERS,
  computeDiscountStack,
  computePointsDelta,
  computeStampEarn,
  computeTier,
  loyaltyScopeKey,
  readLoyaltyConfig,
  sanitizeTiers,
  shouldEarnOnSettlement,
} from './loyalty'

test('tier rules are stable and sanitize duplicate names', () => {
  assert.equal(computeTier(500, DEFAULT_TIERS).tier.name, 'Gümüş')
  const tiers = sanitizeTiers([
    { name: 'VIP', min: 500, color: '#000' },
    { name: 'VIP', min: 0, color: '#fff' },
  ])
  assert.equal(tiers[0]?.min, 0)
  assert.equal(new Set(tiers.map((tier) => tier.name.toLowerCase())).size, 2)
})

test('settings parsing and network scope use one canonical policy', () => {
  const config = readLoyaltyConfig({ loyalty: { points_enabled: true, scope: 'network' } })
  assert.ok(config)
  assert.equal(config.points_enabled, true)
  assert.equal(loyaltyScopeKey(config, 'restaurant-1'), '00000000-0000-0000-0000-000000000000')
})

test('comp never earns and points multiplier remains floored', () => {
  assert.equal(shouldEarnOnSettlement('comp', true), false)
  assert.equal(computePointsDelta(33, 1, 1.5), 49)
})

test('claimed stamp reward cannot re-earn its own unit', () => {
  const coffee = 'coffee'
  assert.equal(computeStampEarn([{ itemId: coffee, quantity: 1 }], new Set([coffee]), coffee, true), 0)
})

test('discount order remains free items, member percentage, then points', () => {
  assert.deepEqual(computeDiscountStack({
    subtotal: 200,
    stampDiscountAmount: 40,
    catalogDiscountAmount: 20,
    memberPct: 10,
    requestedPoints: 500,
    pointsBalance: 500,
    pointsRate: 10,
  }), {
    stampDiscountAmount: 40,
    catalogDiscountAmount: 20,
    memberDiscountAmount: 14,
    pointsDiscountAmount: 50,
    pointsRedeemed: 500,
    finalTotal: 76,
  })
})
