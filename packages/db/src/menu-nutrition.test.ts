import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateMarginPercent, getDietaryClaimsConflict } from './menu-nutrition'

test('calculates margin from authoritative price and cost values', () => {
  assert.equal(calculateMarginPercent(100, 40), 60)
  assert.equal(calculateMarginPercent(99.9, 33.3), 67)
  assert.equal(calculateMarginPercent(50, 75), -50)
})

test('does not fabricate a margin without usable values', () => {
  assert.equal(calculateMarginPercent(0, 10), null)
  assert.equal(calculateMarginPercent(Number.NaN, 10), null)
  assert.equal(calculateMarginPercent(100, null), null)
  assert.equal(calculateMarginPercent(100, -1), null)
})

test('rejects contradictory dietary claims', () => {
  assert.equal(getDietaryClaimsConflict({
    vegetarian: false,
    vegan: true,
    halal: false,
    containsAlcohol: false,
    containsPork: false,
  }), 'Vegan olarak işaretlenen ürün vejetaryen de olmalıdır')

  assert.equal(getDietaryClaimsConflict({
    vegetarian: true,
    vegan: false,
    halal: true,
    containsAlcohol: true,
    containsPork: false,
  }), 'Helal olarak işaretlenen ürün alkol veya domuz kaynaklı bileşen içeremez')

  assert.equal(getDietaryClaimsConflict({
    vegetarian: true,
    vegan: true,
    halal: true,
    containsAlcohol: false,
    containsPork: false,
  }), null)
})
