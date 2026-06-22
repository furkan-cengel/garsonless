import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeStampEarn } from './loyalty'

const COFFEE = '11111111-1111-1111-1111-111111111111'
const TEA = '22222222-2222-2222-2222-222222222222'
const flagged = new Set([COFFEE, TEA]) // both earn stamps

test('no claim → full earn', () => {
  const items = [{ itemId: COFFEE, quantity: 3 }]
  assert.equal(computeStampEarn(items, flagged, COFFEE, false), 3)
})

test('claim → free reward unit does not re-earn (3 − 1 = 2)', () => {
  const items = [{ itemId: COFFEE, quantity: 3 }]
  assert.equal(computeStampEarn(items, flagged, COFFEE, true), 2)
})

test('EDGE: order exactly 1 reward unit + claim → 0 (no re-earn)', () => {
  const items = [{ itemId: COFFEE, quantity: 1 }]
  assert.equal(computeStampEarn(items, flagged, COFFEE, true), 0)
})

test('claim only subtracts from the REWARD item, others unaffected', () => {
  const items = [{ itemId: COFFEE, quantity: 2 }, { itemId: TEA, quantity: 3 }]
  // total 5 flagged units; reward=coffee claimed → 5 − 1 = 4
  assert.equal(computeStampEarn(items, flagged, COFFEE, true), 4)
})

test('reward item not stamp-earning → no subtraction (claim is on a non-earning item)', () => {
  const NONEARN = '33333333-3333-3333-3333-333333333333'
  const items = [{ itemId: COFFEE, quantity: 2 }, { itemId: NONEARN, quantity: 1 }]
  assert.equal(computeStampEarn(items, flagged, NONEARN, true), 2) // coffee 2, NONEARN not flagged
})

test('null reward / claim mismatch → full earn', () => {
  const items = [{ itemId: COFFEE, quantity: 2 }]
  assert.equal(computeStampEarn(items, flagged, null, true), 2)
})
