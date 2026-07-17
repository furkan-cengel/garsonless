import test from 'node:test'
import assert from 'node:assert/strict'
import {
  applyReviewInvalidatingPatch,
  calculateMarginPercent,
  getDietaryClaimsConflict,
  normalizeAllergenCodes,
  normalizeMenuNumericText,
  parseMenuNumericInput,
  separateAllergenDeclarations,
  toggleAllergenDeclaration,
} from './menu'

test('normalizes only supported allergen codes', () => {
  assert.deepEqual(normalizeAllergenCodes(['milk', 'invalid', 'milk', 'eggs']), ['milk', 'eggs'])
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
})

test('parses localized numeric input without accepting malformed values', () => {
  assert.deepEqual(parseMenuNumericInput('12,5', { min: 0 }), { ok: true, value: 12.5 })
  assert.equal(parseMenuNumericInput('1.2.3', { min: 0 }).ok, false)
  assert.equal(parseMenuNumericInput('-1', { min: 0 }).ok, false)
  assert.equal(normalizeMenuNumericText('12,5 TL'), '12.5')
})

test('keeps contains and trace allergen declarations mutually exclusive', () => {
  assert.deepEqual(
    separateAllergenDeclarations(['milk', 'eggs'], ['milk', 'sesame']),
    { contains: ['milk', 'eggs'], traces: ['sesame'] },
  )
  assert.deepEqual(
    toggleAllergenDeclaration([], ['milk'], 'milk', 'contains'),
    { contains: ['milk'], traces: [] },
  )
})

test('invalidates review on policy-relevant patches and calculates margin', () => {
  assert.deepEqual(
    applyReviewInvalidatingPatch({ reviewed: true, energyKcal: '300' }, { energyKcal: '320' }),
    { reviewed: false, energyKcal: '320' },
  )
  assert.equal(calculateMarginPercent(100, 40), 60)
  assert.equal(calculateMarginPercent(0, 40), null)
})
