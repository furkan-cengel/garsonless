import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeTier, sanitizeTiers, DEFAULT_TIERS, MAX_TIERS } from './loyalty'

// DEFAULT_TIERS: Bronz 0, Gümüş 500, Altın 1000, Platin 2500.

test('lifetime 0 → Bronz, next Gümüş, 0% progress', () => {
  const r = computeTier(0, DEFAULT_TIERS)
  assert.equal(r.tier.name, 'Bronz')
  assert.equal(r.tierIndex, 0)
  assert.equal(r.nextTier?.name, 'Gümüş')
  assert.equal(r.tierProgress, 0)
})

test('just BELOW a threshold stays in the lower tier', () => {
  const r = computeTier(499, DEFAULT_TIERS)
  assert.equal(r.tier.name, 'Bronz')
  assert.equal(r.tierProgress, 99) // floor(499/500*100)
})

test('exactly AT a threshold promotes', () => {
  const r = computeTier(500, DEFAULT_TIERS)
  assert.equal(r.tier.name, 'Gümüş')
  assert.equal(r.nextTier?.name, 'Altın')
  assert.equal(r.tierProgress, 0)
})

test('ABOVE a threshold (mid-tier)', () => {
  const r = computeTier(1000, DEFAULT_TIERS)
  assert.equal(r.tier.name, 'Altın')
  assert.equal(r.nextTier?.name, 'Platin')
  assert.equal(r.tierProgress, 0)
})

test('progress is measured within the current tier interval', () => {
  const silver = computeTier(750, DEFAULT_TIERS)
  assert.equal(silver.tier.name, 'Gümüş')
  assert.equal(silver.tierProgress, 50)

  const gold = computeTier(1750, DEFAULT_TIERS)
  assert.equal(gold.tier.name, 'Altın')
  assert.equal(gold.tierProgress, 50)
})

test('top tier → no next, 100% progress', () => {
  const r = computeTier(2500, DEFAULT_TIERS)
  assert.equal(r.tier.name, 'Platin')
  assert.equal(r.nextTier, null)
  assert.equal(r.tierProgress, 100)
})

test('way above top tier still Platin', () => {
  assert.equal(computeTier(99999, DEFAULT_TIERS).tier.name, 'Platin')
})

test('negative guarded → Bronz', () => {
  assert.equal(computeTier(-50, DEFAULT_TIERS).tier.name, 'Bronz')
})

// ─── Sprint 17: flexible N tiers + perks ─────────────────────────────────────

test('FLEXIBLE: 2-tier ladder ranks correctly', () => {
  const tiers = sanitizeTiers([{ name: 'Standart', min: 0, color: '#aaa' }, { name: 'VIP', min: 300, color: '#000' }])
  assert.equal(tiers.length, 2)
  assert.equal(computeTier(0, tiers).tier.name, 'Standart')
  assert.equal(computeTier(299, tiers).tier.name, 'Standart')
  assert.equal(computeTier(300, tiers).tier.name, 'VIP')
  assert.equal(computeTier(300, tiers).nextTier, null) // VIP is top
  assert.equal(computeTier(150, tiers).tierProgress, 50)
})

test('FLEXIBLE: 6-tier ladder (the cap) ranks across all bands', () => {
  const raw = Array.from({ length: 6 }, (_, i) => ({ name: `T${i}`, min: i * 200, color: '#111' }))
  const tiers = sanitizeTiers(raw)
  assert.equal(tiers.length, 6)
  assert.equal(computeTier(0, tiers).tierIndex, 0)
  assert.equal(computeTier(1000, tiers).tierIndex, 5) // 5*200
  assert.equal(computeTier(550, tiers).tier.name, 'T2') // 400 ≤ 550 < 600
})

test('CAP: more than MAX_TIERS is truncated', () => {
  const raw = Array.from({ length: 9 }, (_, i) => ({ name: `T${i}`, min: i * 100, color: '#111' }))
  assert.equal(sanitizeTiers(raw).length, MAX_TIERS)
})

test('PERK resolution: defaults filled + explicit perks clamped', () => {
  const tiers = sanitizeTiers([
    { name: 'Base', min: 0, color: '#aaa' }, // no perks → defaults
    { name: 'Gold', min: 500, color: '#c8922a', discountPct: 200, pointsMultiplier: 99, bonusStamps: -3, priorityService: true },
  ])
  // base defaults
  assert.deepEqual(
    { d: tiers[0]!.discountPct, m: tiers[0]!.pointsMultiplier, b: tiers[0]!.bonusStamps, p: tiers[0]!.priorityService },
    { d: 0, m: 1, b: 0, p: false },
  )
  // gold clamped: discountPct≤100, multiplier≤10, bonusStamps≥0
  assert.equal(tiers[1]!.discountPct, 100)
  assert.equal(tiers[1]!.pointsMultiplier, 10)
  assert.equal(tiers[1]!.bonusStamps, 0)
  assert.equal(tiers[1]!.priorityService, true)
  // fractional multiplier preserved
  assert.equal(sanitizeTiers([{ name: 'X', min: 0, color: '#0', pointsMultiplier: 1.5 }])[0]!.pointsMultiplier, 1.5)
})

test('NAME fallback for N>4 (no collision on old default names)', () => {
  // 5 tiers, the 5th has no name → "Seviye 5", never a duplicate of defaults
  const tiers = sanitizeTiers([
    { min: 0, color: '#0' }, { min: 100, color: '#0' }, { min: 200, color: '#0' },
    { min: 300, color: '#0' }, { min: 400, color: '#0' },
  ])
  assert.equal(tiers.length, 5)
  assert.equal(tiers[4]!.name, 'Seviye 5')
  const names = tiers.map((t) => t.name.toLowerCase())
  assert.equal(new Set(names).size, names.length) // all unique
})

test('SANITIZE: out-of-order ladder is sorted + base forced to 0', () => {
  const tiers = sanitizeTiers([
    { name: 'B', min: 800, color: '#0' }, { name: 'A', min: 50, color: '#0' }, { name: 'C', min: 1500, color: '#0' },
  ])
  assert.deepEqual(tiers.map((t) => t.name), ['A', 'B', 'C'])
  assert.equal(tiers[0]!.min, 0) // base forced to 0 (was 50)
})

test('DUPLICATE names are de-duped', () => {
  const tiers = sanitizeTiers([{ name: 'Gold', min: 0, color: '#0' }, { name: 'Gold', min: 500, color: '#0' }])
  assert.notEqual(tiers[0]!.name.toLowerCase(), tiers[1]!.name.toLowerCase())
})
