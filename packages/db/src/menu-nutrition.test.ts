import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeIngredients } from './menu-domain'
import {
  applyReviewInvalidatingPatch,
  calculateMarginPercent,
  getDietaryClaimsConflict,
  moveListItem,
  normalizeMenuNumericText,
  parseMenuNumericInput,
  separateAllergenDeclarations,
  toggleAllergenDeclaration,
} from './menu-nutrition'

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

test('parses decimal input without silently changing malformed values', () => {
  assert.deepEqual(parseMenuNumericInput('12,5', { min: 0 }), { ok: true, value: 12.5 })
  assert.deepEqual(parseMenuNumericInput('', { min: 0 }), { ok: true, value: null })
  assert.equal(parseMenuNumericInput('', { required: true }).ok, false)
  assert.equal(parseMenuNumericInput('1.2.3', { min: 0 }).ok, false)
  assert.equal(parseMenuNumericInput('-1', { min: 0 }).ok, false)
  assert.equal(parseMenuNumericInput('12.5', { integer: true, min: 0 }).ok, false)
  assert.equal(parseMenuNumericInput('101', { max: 100 }).ok, false)
  assert.equal(normalizeMenuNumericText('12,5 TL'), '12.5')
})

test('keeps contains and cross-contact declarations mutually exclusive', () => {
  assert.deepEqual(
    separateAllergenDeclarations(['milk', 'eggs'], ['milk', 'sesame']),
    { contains: ['milk', 'eggs'], traces: ['sesame'] },
  )
  assert.deepEqual(
    toggleAllergenDeclaration([], ['milk'], 'milk', 'contains'),
    { contains: ['milk'], traces: [] },
  )
  assert.deepEqual(
    toggleAllergenDeclaration(['milk'], [], 'milk', 'trace'),
    { contains: ['milk'], traces: [] },
  )
})

test('ingredient reorder survives JSON persistence and legacy normalization', () => {
  const ingredients = [
    { id: 'onion', name: ' Soğan ', amount: ' 20 g ', removable: true, allergen_codes: [] },
    { id: 'tomato', name: ' Domates ', amount: ' 80 g ', removable: false, allergen_codes: [] },
  ]
  const moved = moveListItem(ingredients, 1, -1)
  const persisted = normalizeIngredients(JSON.parse(JSON.stringify(moved)))
  assert.deepEqual(persisted.map((ingredient) => [ingredient.id, ingredient.name, ingredient.amount]), [
    ['tomato', 'Domates', '80 g'],
    ['onion', 'Soğan', '20 g'],
  ])
  assert.deepEqual(moveListItem(persisted, 0, -1), persisted)
})

test('nutrition changes invalidate review until it is explicitly rechecked', () => {
  const current = { reviewed: true, energyKcal: '300', ingredients: ['one'] }
  assert.deepEqual(
    applyReviewInvalidatingPatch(current, { energyKcal: '320' }),
    { reviewed: false, energyKcal: '320', ingredients: ['one'] },
  )
  assert.deepEqual(
    applyReviewInvalidatingPatch(current, { reviewed: true, energyKcal: '320' }),
    { reviewed: true, energyKcal: '320', ingredients: ['one'] },
  )
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
