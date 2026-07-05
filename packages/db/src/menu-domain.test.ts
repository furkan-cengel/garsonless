import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildOrderLineSnapshot,
  normalizeIngredients,
  normalizeModifierGroups,
  readOrderLineSnapshots,
  resolveModifierSelections,
} from './menu-domain'

const groups = [{
  id: 'size',
  name: 'Boyut',
  selection_mode: 'single',
  required: true,
  min: 1,
  max: 1,
  options: [
    { id: 'small', name: 'Küçük', price_delta: 0, calorie_delta: 0, is_default: true, allergen_codes: [] },
    { id: 'large', name: 'Büyük', price_delta: 20, calorie_delta: 80, is_default: false, allergen_codes: ['milk'] },
  ],
}, {
  id: 'extra',
  name: 'Ekstra',
  selection_mode: 'quantity',
  required: false,
  min: 0,
  max: 2,
  options: [
    { id: 'shot', name: 'Shot', price_delta: 15, calorie_delta: 5, is_default: false, allergen_codes: [] },
  ],
}]

const menuItem = {
  id: 'burger',
  name: 'Burger',
  price: 120,
  is_available: true,
  ingredients: [
    { id: 'onion', name: 'Soğan', removable: true, allergen_codes: [] },
    { id: 'bread', name: 'Ekmek', removable: false, allergen_codes: ['gluten'] },
  ],
  energy_kcal: 500,
  may_contain_allergens: ['sesame'],
  contains_allergens: ['eggs'],
  contains_alcohol: false,
  contains_pork: false,
  modifier_groups: groups,
}

test('normalizes legacy required modifier groups', () => {
  const result = normalizeModifierGroups([{
    id: 'legacy',
    name: 'Boyut',
    type: 'required',
    options: [{ id: 'one', name: 'Tek', price_delta: 0 }],
  }])
  assert.equal(result[0]?.selection_mode, 'single')
  assert.equal(result[0]?.min, 1)
  assert.equal(result[0]?.max, 1)
})

test('rejects missing required selections', () => {
  const result = resolveModifierSelections(groups, [])
  assert.equal(result.ok, false)
})

test('rejects unknown and duplicate modifier options', () => {
  assert.equal(resolveModifierSelections(groups, [{ group_id: 'size', option_id: 'tampered' }]).ok, false)
  assert.equal(resolveModifierSelections(groups, [
    { group_id: 'size', option_id: 'small' },
    { group_id: 'size', option_id: 'small' },
  ]).ok, false)
})

test('enforces quantity maximum and resolves calorie/price data', () => {
  assert.equal(resolveModifierSelections(groups, [
    { group_id: 'size', option_id: 'large' },
    { group_id: 'extra', option_id: 'shot', quantity: 3 },
  ]).ok, false)
  const result = resolveModifierSelections(groups, [
    { group_id: 'size', option_id: 'large' },
    { group_id: 'extra', option_id: 'shot', quantity: 2 },
  ])
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.modifiers[0]?.priceDelta, 20)
    assert.equal(result.modifiers[0]?.calorieDelta, 80)
    assert.deepEqual(result.modifiers[0]?.allergenCodes, ['milk'])
    assert.equal(result.modifiers[1]?.quantity, 2)
  }
})

test('normalizes structured removable ingredients and allergen codes', () => {
  const result = normalizeIngredients([{
    id: 'onion',
    name: ' Soğan ',
    amount: ' 60 g ',
    removable: true,
    allergen_codes: ['milk', 'invalid'],
  }])
  assert.deepEqual(result, [{
    id: 'onion',
    name: 'Soğan',
    amount: '60 g',
    removable: true,
    allergen_codes: ['milk'],
  }])
})

test('builds authoritative price, calorie, allergen and removal snapshot', () => {
  const result = buildOrderLineSnapshot({
    item: menuItem,
    quantity: 2,
    selections: [{ group_id: 'size', option_id: 'large' }],
    removedIngredientIds: ['onion'],
  })
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.snapshot.price, 120)
    assert.equal(result.snapshot.modifiersPriceDelta, 20)
    assert.equal(result.snapshot.energyKcal, 580)
    assert.deepEqual(result.snapshot.removedIngredients, [{ id: 'onion', name: 'Soğan' }])
    assert.deepEqual(result.snapshot.allergens.sort(), ['eggs', 'gluten', 'milk'])
    assert.deepEqual(result.snapshot.mayContainAllergens, ['sesame'])
    assert.ok(result.snapshot.allergens.includes('gluten'), 'removing onion must not erase product allergen warnings')
  }
})

test('rejects removal of a non-removable ingredient', () => {
  const result = buildOrderLineSnapshot({
    item: menuItem,
    quantity: 1,
    selections: [{ group_id: 'size', option_id: 'small' }],
    removedIngredientIds: ['bread'],
  })
  assert.deepEqual(result, { ok: false, error: 'Ingredient cannot be removed' })
})

test('reads canonical and legacy order lines without changing snapshots', () => {
  const stored = [{
    itemId: 'item',
    name: 'Burger',
    price: 120,
    quantity: 2,
    modifiersPriceDelta: 10,
    modifiers: [{ optionName: 'Büyük', quantity: 1 }],
    removedIngredients: [{ id: 'onion', name: 'Soğan' }],
    energyKcal: 640,
    allergens: ['gluten'],
  }, {
    name: 'Legacy',
    price: 40,
    qty: 1,
    modifiers: [{ name: 'Sade' }],
  }]
  const parsed = readOrderLineSnapshots(stored)
  assert.equal(parsed[0]?.quantity, 2)
  assert.equal(parsed[0]?.removedIngredients[0]?.name, 'Soğan')
  assert.equal(parsed[0]?.energyKcal, 640)
  assert.equal(parsed[1]?.quantity, 1)
  assert.equal(parsed[1]?.modifiers[0]?.optionName, 'Sade')
})
