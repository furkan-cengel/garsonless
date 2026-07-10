import test from 'node:test'
import assert from 'node:assert/strict'
import { computeVatBreakdown } from './order-tax'

test('computes VAT-inclusive line breakdowns grouped by rate', () => {
  const result = computeVatBreakdown([
    { price: 101, quantity: 1, vatRate: 1 },
    { price: 110, quantity: 1, vatRate: 10 },
    { price: 120, quantity: 1, vatRate: 20 },
  ])

  assert.deepEqual(result.byRate, [
    { rate: 1, net: 100, vat: 1, gross: 101 },
    { rate: 10, net: 100, vat: 10, gross: 110 },
    { rate: 20, net: 100, vat: 20, gross: 120 },
  ])
  assert.equal(result.netTotal, 300)
  assert.equal(result.vatTotal, 31)
  assert.equal(result.grossTotal, 331)
  assert.equal(result.unknownGrossTotal, 0)
})

test('rounds per line before grouping and keeps unknown historical rates separate', () => {
  const result = computeVatBreakdown([
    { price: 10, quantity: 1, vatRate: 10 },
    { price: 10, quantity: 1, vatRate: 10 },
    { price: 40, quantity: 1, vatRate: null },
  ])

  assert.deepEqual(result.byRate, [
    { rate: 10, net: 18.18, vat: 1.82, gross: 20 },
  ])
  assert.equal(result.netTotal, 18.18)
  assert.equal(result.vatTotal, 1.82)
  assert.equal(result.grossTotal, 60)
  assert.equal(result.unknownGrossTotal, 40)
  assert.equal(result.discountTotal, 0)
})

// ── discount allocation (chargedTotal = the real post-discount orders.total) ──

test('DISCOUNT: breakdown sums EXACTLY to the charged total, VAT on the discounted base', () => {
  // Line sum 100, charged 80 (₺20 loyalty discount) → 20% off every bucket.
  const result = computeVatBreakdown(
    [
      { price: 50, quantity: 1, vatRate: 10 },
      { price: 50, quantity: 1, vatRate: 20 },
    ],
    80,
  )

  assert.equal(result.discountTotal, 20)
  assert.equal(result.grossTotal, 80) // == charged, not the line sum
  assert.deepEqual(result.byRate, [
    { rate: 10, net: 36.36, vat: 3.64, gross: 40 },
    { rate: 20, net: 33.33, vat: 6.67, gross: 40 },
  ])
  // The receipt invariant: net + vat == charged total, kuruş-exact.
  assert.equal(result.netTotal + result.vatTotal, result.grossTotal)
})

test('DISCOUNT: rounding residual lands on the largest bucket (sum stays exact)', () => {
  // Line sum 100 → factor 0.33 puts 0.33-rounding drift in play.
  const result = computeVatBreakdown(
    [
      { price: 33.35, quantity: 1, vatRate: 10 },
      { price: 33.35, quantity: 1, vatRate: 10 },
      { price: 33.30, quantity: 1, vatRate: 20 },
    ],
    33,
  )

  const bucketSum = result.byRate.reduce((s, r) => s + r.gross, 0) + result.unknownGrossTotal
  assert.equal(Math.round(bucketSum * 100) / 100, 33) // exact to the kuruş
  assert.equal(result.grossTotal, 33)
  assert.equal(result.discountTotal, 67) // line sum 100.00 − charged 33
})

test('DISCOUNT: unknown-rate bucket shares the discount proportionally', () => {
  // 60 known @10% + 40 unknown = 100, charged 50 → both halved.
  const result = computeVatBreakdown(
    [
      { price: 60, quantity: 1, vatRate: 10 },
      { price: 40, quantity: 1, vatRate: null },
    ],
    50,
  )

  assert.equal(result.discountTotal, 50)
  assert.equal(result.byRate[0]?.gross, 30)
  assert.equal(result.unknownGrossTotal, 20)
  assert.equal(result.grossTotal, 50)
})

test('DISCOUNT: chargedTotal ≥ line sum or omitted → no scaling, discountTotal 0', () => {
  const lines = [{ price: 100, quantity: 1, vatRate: 10 }]
  for (const charged of [undefined, null, 100, 150]) {
    const result = computeVatBreakdown(lines, charged)
    assert.equal(result.discountTotal, 0)
    assert.equal(result.grossTotal, 100)
    assert.equal(result.byRate[0]?.gross, 100)
  }
})

test('DISCOUNT: chargedTotal 0 (fully covered by points) → all buckets zero', () => {
  const result = computeVatBreakdown(
    [
      { price: 60, quantity: 1, vatRate: 10 },
      { price: 40, quantity: 1, vatRate: null },
    ],
    0,
  )

  assert.equal(result.discountTotal, 100)
  assert.equal(result.grossTotal, 0)
  assert.equal(result.netTotal, 0)
  assert.equal(result.vatTotal, 0)
  assert.equal(result.unknownGrossTotal, 0)
})
