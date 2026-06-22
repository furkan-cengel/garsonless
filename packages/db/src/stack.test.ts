import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeDiscountStack, effectivePct } from './loyalty'

// Order: stamp-free → member % → points. Member % floored to whole ₺, on the
// post-stamp amount. Points come off the remainder (rate = points per ₺1).

test('member 10% only (no points): floor to whole ₺', () => {
  // subtotal 185, 10% → floor(18.5)=18, final 167
  const r = computeDiscountStack({ subtotal: 185, stampDiscountAmount: 0, memberPct: 10, requestedPoints: 0, pointsBalance: 0, pointsRate: 10 })
  assert.equal(r.memberDiscountAmount, 18)
  assert.equal(r.pointsDiscountAmount, 0)
  assert.equal(r.finalTotal, 167)
})

test('member 10% THEN points: % first, points off remainder', () => {
  // subtotal 200 → member 10% = 20 → remaining 180 → redeem 50 pts (rate 10 = ₺5)
  // final = 200 − 20 − 5 = 175
  const r = computeDiscountStack({ subtotal: 200, stampDiscountAmount: 0, memberPct: 10, requestedPoints: 50, pointsBalance: 500, pointsRate: 10 })
  assert.equal(r.memberDiscountAmount, 20)
  assert.equal(r.pointsDiscountAmount, 5)
  assert.equal(r.pointsRedeemed, 50)
  assert.equal(r.finalTotal, 175)
})

test('points capped by the POST-member remaining, not subtotal', () => {
  // subtotal 100 → member 50% = 50 → remaining 50 → try redeem ₺80 worth (800 pts)
  // points clamp to remaining 50 → final 0
  const r = computeDiscountStack({ subtotal: 100, stampDiscountAmount: 0, memberPct: 50, requestedPoints: 800, pointsBalance: 800, pointsRate: 10 })
  assert.equal(r.memberDiscountAmount, 50)
  assert.equal(r.pointsDiscountAmount, 50)
  assert.equal(r.finalTotal, 0)
})

test('pct = 0 → no member discount', () => {
  const r = computeDiscountStack({ subtotal: 185, stampDiscountAmount: 0, memberPct: 0, requestedPoints: 0, pointsBalance: 0, pointsRate: 10 })
  assert.equal(r.memberDiscountAmount, 0)
  assert.equal(r.finalTotal, 185)
})

test('member % never makes total negative', () => {
  const r = computeDiscountStack({ subtotal: 10, stampDiscountAmount: 0, memberPct: 100, requestedPoints: 0, pointsBalance: 0, pointsRate: 10 })
  assert.equal(r.memberDiscountAmount, 10)
  assert.equal(r.finalTotal, 0)
})

test('stamp → member → points full stack (stamp stub via amount)', () => {
  // subtotal 300, stamp ₺100 off → afterStamp 200 → member 10% = 20 → rem 180
  // → redeem ₺30 (300 pts) → final 300 − 100 − 20 − 30 = 150
  const r = computeDiscountStack({ subtotal: 300, stampDiscountAmount: 100, memberPct: 10, requestedPoints: 300, pointsBalance: 1000, pointsRate: 10 })
  assert.equal(r.stampDiscountAmount, 100)
  assert.equal(r.memberDiscountAmount, 20)
  assert.equal(r.pointsDiscountAmount, 30)
  assert.equal(r.finalTotal, 150)
})

// ── 15c: catalog free-item slot (stamp → catalog → member % → points) ──

test('catalog free item comes off at full price, before member %', () => {
  // subtotal 200, catalog item ₺50 free → afterFree 150 → member 10% = 15
  // final = 200 − 50 − 15 = 135. (either/or: points-as-₺ passed 0)
  const r = computeDiscountStack({ subtotal: 200, stampDiscountAmount: 0, catalogDiscountAmount: 50, memberPct: 10, requestedPoints: 0, pointsBalance: 0, pointsRate: 10 })
  assert.equal(r.catalogDiscountAmount, 50)
  assert.equal(r.memberDiscountAmount, 15)
  assert.equal(r.pointsDiscountAmount, 0)
  assert.equal(r.finalTotal, 135)
})

test('stamp-free AND catalog-free stack (both full price), then member %', () => {
  // subtotal 300, stamp ₺50 + catalog ₺40 → afterFree 210 → member 10% = 21
  // final = 300 − 50 − 40 − 21 = 189
  const r = computeDiscountStack({ subtotal: 300, stampDiscountAmount: 50, catalogDiscountAmount: 40, memberPct: 10, requestedPoints: 0, pointsBalance: 0, pointsRate: 10 })
  assert.equal(r.stampDiscountAmount, 50)
  assert.equal(r.catalogDiscountAmount, 40)
  assert.equal(r.memberDiscountAmount, 21)
  assert.equal(r.finalTotal, 189)
})

test('catalog defaults to 0 when omitted (back-compat)', () => {
  const r = computeDiscountStack({ subtotal: 100, stampDiscountAmount: 0, memberPct: 0, requestedPoints: 0, pointsBalance: 0, pointsRate: 10 })
  assert.equal(r.catalogDiscountAmount, 0)
  assert.equal(r.finalTotal, 100)
})

test('catalog never makes total negative', () => {
  const r = computeDiscountStack({ subtotal: 30, stampDiscountAmount: 0, catalogDiscountAmount: 50, memberPct: 0, requestedPoints: 0, pointsBalance: 0, pointsRate: 10 })
  // catalog clamped by subtotal in finalTotal (max 0); the slot reports the raw 50.
  assert.equal(r.finalTotal, 0)
})

// ─── 17b: effectivePct (tier discount supersedes legacy member %) ────────────

test('effectivePct: tier discountPct > 0 overrides member_discount_pct', () => {
  assert.equal(effectivePct(15, 10), 15)
})

test('effectivePct: tier discountPct 0 falls back to legacy member_discount_pct', () => {
  assert.equal(effectivePct(0, 10), 10) // legacy all-zero-perk config keeps today's behavior
})

test('effectivePct: both 0 → no member discount (guest/no-perk)', () => {
  assert.equal(effectivePct(0, 0), 0)
})

test('17b stacking: tier 15% on post-stamp amount, then points on remainder', () => {
  // subtotal 200, stamp-free 50 → after 150; tier 15% = floor(150*.15)=22; remaining 128;
  // points: request 100 @ rate 10 → ₺10 off (capped by remaining). final = 200-50-22-10 = 118.
  const r = computeDiscountStack({
    subtotal: 200, stampDiscountAmount: 50, memberPct: effectivePct(15, 10),
    requestedPoints: 100, pointsBalance: 100, pointsRate: 10,
  })
  assert.equal(r.memberDiscountAmount, 22)
  assert.equal(r.pointsDiscountAmount, 10)
  assert.equal(r.finalTotal, 118)
})
