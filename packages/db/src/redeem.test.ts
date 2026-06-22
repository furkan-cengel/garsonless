import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computePointsRedemption } from './loyalty'

// rate = points needed for ₺1 of discount (e.g. 10 → 10 puan = ₺1).

test('canonical: floor(points/rate), whole ₺, exact points consumed', () => {
  // 50 points at rate 10 → ₺5, consumes 50
  assert.deepEqual(computePointsRedemption(50, 500, 100, 10), { pointsDiscountAmount: 5, pointsConsumed: 50 })
})

test('clamped by balance', () => {
  // wants 100 pts but only has 43; rate 10 → floor(43/10)=₺4, consumes 40 (no waste)
  assert.deepEqual(computePointsRedemption(100, 43, 100, 10), { pointsDiscountAmount: 4, pointsConsumed: 40 })
})

test('clamped by remaining bill', () => {
  // 1000 pts, rate 10 → ₺100 of value, but bill is only ₺7 → ₺7, consumes 70
  assert.deepEqual(computePointsRedemption(1000, 1000, 7, 10), { pointsDiscountAmount: 7, pointsConsumed: 70 })
})

test('sub-₺ leftover points are not consumed', () => {
  // 57 pts at rate 10 → floor(57/10)=₺5, consumes 50 (7 left unspent)
  assert.deepEqual(computePointsRedemption(57, 57, 100, 10), { pointsDiscountAmount: 5, pointsConsumed: 50 })
})

test('rate = 100 (100 puan = ₺1)', () => {
  assert.deepEqual(computePointsRedemption(250, 250, 100, 100), { pointsDiscountAmount: 2, pointsConsumed: 200 })
})

test('zero / invalid inputs → no redemption', () => {
  assert.deepEqual(computePointsRedemption(0, 500, 100, 10), { pointsDiscountAmount: 0, pointsConsumed: 0 })
  assert.deepEqual(computePointsRedemption(50, 0, 100, 10), { pointsDiscountAmount: 0, pointsConsumed: 0 })
  assert.deepEqual(computePointsRedemption(50, 500, 0, 10), { pointsDiscountAmount: 0, pointsConsumed: 0 })
  assert.deepEqual(computePointsRedemption(50, 500, 100, 0), { pointsDiscountAmount: 0, pointsConsumed: 0 })
})
