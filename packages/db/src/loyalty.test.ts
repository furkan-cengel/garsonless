import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  computeStampDelta,
  computePointsDelta,
  applyBonusStamps,
  readOrderCustomerTierSnapshot,
  orderHasPriorityService,
  sortOrdersByPriorityThenCreatedAt,
} from './loyalty'

const COFFEE = '11111111-1111-1111-1111-111111111111'
const CAKE = '22222222-2222-2222-2222-222222222222'
const WATER = '33333333-3333-3333-3333-333333333333'

test('per-item stamp delta = sum of flagged quantities (3 coffees → 3)', () => {
  const items = [
    { itemId: COFFEE, quantity: 3 },
    { itemId: WATER, quantity: 2 },
  ]
  assert.equal(computeStampDelta(items, new Set([COFFEE])), 3)
})

test('multiple flagged items sum together; unflagged ignored', () => {
  const items = [
    { itemId: COFFEE, quantity: 2 },
    { itemId: CAKE, quantity: 4 },
    { itemId: WATER, quantity: 9 },
  ]
  assert.equal(computeStampDelta(items, new Set([COFFEE, CAKE])), 6)
})

test('no flagged items → 0 stamps', () => {
  const items = [{ itemId: WATER, quantity: 5 }]
  assert.equal(computeStampDelta(items, new Set([COFFEE])), 0)
})

test('malformed / empty items → 0 (no throw)', () => {
  assert.equal(computeStampDelta(null, new Set([COFFEE])), 0)
  assert.equal(computeStampDelta([], new Set([COFFEE])), 0)
  assert.equal(computeStampDelta([{ quantity: 3 }, { itemId: COFFEE }], new Set([COFFEE])), 0)
})

test('points = floor(total * perLira), guarded', () => {
  assert.equal(computePointsDelta(349, 1), 349)
  assert.equal(computePointsDelta(120.9, 1), 120)
  assert.equal(computePointsDelta(200, 0.5), 100)
  assert.equal(computePointsDelta(0, 1), 0)
  assert.equal(computePointsDelta(-50, 1), 0)
  assert.equal(computePointsDelta(NaN, 1), 0)
})

// ─── 17b: points multiplier + bonus stamps ───────────────────────────────────

test('points multiplier: 1× identical to today; 1.5× and 2× floor correctly', () => {
  assert.equal(computePointsDelta(85, 1), 85)        // default
  assert.equal(computePointsDelta(85, 1, 1), 85)     // explicit 1×
  assert.equal(computePointsDelta(85, 1, 2), 170)    // 2×
  assert.equal(computePointsDelta(85, 1, 1.5), 127)  // floor(127.5)
  assert.equal(computePointsDelta(33, 1, 1.5), 49)   // floor(49.5)
  assert.equal(computePointsDelta(0, 1, 2), 0)
})

test('bonus stamps: added only when base stampDelta >= 1', () => {
  assert.equal(applyBonusStamps(0, 1), 0)   // no base stamp → no bonus minted
  assert.equal(applyBonusStamps(1, 1), 2)   // 1 earned + 1 bonus
  assert.equal(applyBonusStamps(3, 2), 5)   // stacks on the net delta
  assert.equal(applyBonusStamps(2, 0), 2)   // default bonus 0 → unchanged
  assert.equal(applyBonusStamps(5, 0), 5)
})

// ─── 17c: order tier snapshot + priority sort ────────────────────────────────

test('order tier snapshot reader: legacy/malformed orders are non-priority', () => {
  assert.equal(readOrderCustomerTierSnapshot(null), null)
  assert.equal(readOrderCustomerTierSnapshot({ priorityService: true }), null)
  assert.equal(orderHasPriorityService({ customer_tier: null }), false)
})

test('order tier snapshot reader: priority flag and clamped perks', () => {
  const snap = readOrderCustomerTierSnapshot({
    name: 'VIP',
    min: 300,
    color: '#111111',
    tierIndex: 1,
    lifetimePoints: 500,
    discountPct: 15,
    pointsMultiplier: 2,
    bonusStamps: 1,
    priorityService: true,
  })
  assert.equal(snap?.name, 'VIP')
  assert.equal(snap?.priorityService, true)
  assert.equal(orderHasPriorityService({ customer_tier: snap }), true)
})

test('priority service sort: priority orders first, then older first', () => {
  const orders = [
    { id: 'normal-old', created_at: '2026-06-18T10:00:00.000Z', customer_tier: null },
    { id: 'priority-new', created_at: '2026-06-18T10:05:00.000Z', customer_tier: { name: 'VIP', priorityService: true } },
    { id: 'priority-old', created_at: '2026-06-18T09:55:00.000Z', customer_tier: { name: 'Gold', priorityService: true } },
    { id: 'normal-new', created_at: '2026-06-18T10:10:00.000Z', customer_tier: { name: 'Bronz', priorityService: false } },
  ]
  assert.deepEqual(sortOrdersByPriorityThenCreatedAt(orders).map((o) => o.id), [
    'priority-old',
    'priority-new',
    'normal-old',
    'normal-new',
  ])
})
