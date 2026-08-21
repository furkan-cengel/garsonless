import assert from 'node:assert/strict'
import test from 'node:test'
import type { MenuItem } from '../../../menu/types'
import { resolveComboRibbonGroups, resolveComboRibbonState } from './comboRibbonModel'

const item = (id: string, price: number, position: number, overrides: Partial<MenuItem> = {}): MenuItem => ({
  id,
  category_id: 'category-1',
  name: overrides.name ?? id,
  description: null,
  price,
  images: overrides.images ?? [],
  ingredients: overrides.ingredients ?? [],
  energy_kcal: null,
  contains_allergens: [],
  may_contain_allergens: [],
  allergen_note: null,
  cross_contact_note: null,
  contains_alcohol: false,
  contains_pork: false,
  is_vegetarian: false,
  is_vegan: false,
  is_halal: false,
  food_info_reviewed_at: null,
  modifier_groups: overrides.modifier_groups ?? [],
  is_available: overrides.is_available ?? true,
  position,
})

test('automatic combos partition live products and calculate totals from menu prices', () => {
  const groups = resolveComboRibbonGroups(
    { comboCount: '2', itemsPerCombo: '2' },
    [item('third', 70, 3), item('first', 30, 1), item('second', 50, 2), item('fourth', 90, 4)],
  )

  assert.deepEqual(groups.map((group) => group.items.map(({ id }) => id)), [['first', 'second'], ['third', 'fourth']])
  assert.deepEqual(groups.map(({ total }) => total), [80, 160])
})

test('manual combos preserve editor order while dropping stale, duplicate and passive ids', () => {
  const groups = resolveComboRibbonGroups({
    selectionMode: 'manual',
    comboCount: '1',
    itemsPerCombo: '3',
    combo1Item1Id: 'latte',
    combo1Item2Id: 'missing',
    combo1Item3Id: 'brownie',
  }, [
    item('brownie', 140, 1),
    item('latte', 110, 2),
    item('hidden', 50, 3, { is_available: false }),
  ])

  assert.deepEqual(groups[0]?.items.map(({ id }) => id), ['latte', 'brownie'])
  assert.equal(groups[0]?.total, 250)
})

test('combo cards fail closed with fewer than two live products', () => {
  assert.deepEqual(resolveComboRibbonGroups({ comboCount: '1' }, [item('only', 100, 1)]), [])
})

test('combos expose required product configuration without becoming invalid', () => {
  const groups = resolveComboRibbonGroups({ comboCount: '1' }, [
    item('plain', 100, 1),
    item('configurable', 120, 2, {
      ingredients: [{ id: 'milk', name: 'Süt', removable: true, allergen_codes: [] }],
    }),
  ])

  assert.equal(groups[0]?.requiresConfiguration, true)
})

test('a merchant special price replaces the catalog total without changing its reference', () => {
  const groups = resolveComboRibbonGroups({ comboCount: '1', combo1Price: '200,00' }, [
    item('coffee', 120, 1),
    item('cake', 180, 2),
  ])

  assert.equal(groups[0]?.catalogTotal, 300)
  assert.equal(groups[0]?.total, 200)
  assert.equal(groups[0]?.hasSpecialPrice, true)
})

test('modern combos support four complete products and expose exact savings', () => {
  const groups = resolveComboRibbonGroups({
    editorialVersion: '2',
    selectionMode: 'manual',
    comboCount: '1',
    itemsPerCombo: '4',
    combo1Item1Id: 'one',
    combo1Item2Id: 'two',
    combo1Item3Id: 'three',
    combo1Item4Id: 'four',
    combo1Price: '300',
  }, [item('one', 100, 1), item('two', 100, 2), item('three', 100, 3), item('four', 100, 4)])

  assert.deepEqual(groups[0]?.items.map(({ id }) => id), ['one', 'two', 'three', 'four'])
  assert.equal(groups[0]?.total, 300)
  assert.equal(groups[0]?.savings, 100)
  assert.equal(groups[0]?.savingsPercent, 25)
})

test('modern combos fail closed for incomplete products and non-discount campaign prices', () => {
  const incomplete = resolveComboRibbonState({
    editorialVersion: '2', selectionMode: 'manual', comboCount: '1', itemsPerCombo: '3',
    combo1Item1Id: 'one', combo1Item2Id: 'missing', combo1Item3Id: 'three',
  }, [item('one', 100, 1), item('three', 100, 3)])
  assert.deepEqual(incomplete.groups, [])
  assert.ok(incomplete.issues.some(({ code }) => code === 'missing-item'))
  assert.ok(incomplete.issues.some(({ code }) => code === 'insufficient-items'))

  const invalidPrice = resolveComboRibbonState({ editorialVersion: '2', comboCount: '1', combo1Price: '300' }, [
    item('one', 100, 1), item('two', 100, 2),
  ])
  assert.deepEqual(invalidPrice.groups, [])
  assert.ok(invalidPrice.issues.some(({ code }) => code === 'invalid-campaign-price'))
})

test('legacy non-discount totals remain priced without being presented as savings', () => {
  const groups = resolveComboRibbonGroups({ comboCount: '1', combo1Price: '300' }, [
    item('one', 100, 1), item('two', 100, 2),
  ])
  assert.equal(groups[0]?.total, 300)
  assert.equal(groups[0]?.hasSpecialPrice, false)
  assert.equal(groups[0]?.hasLegacyNonPromotionalPrice, true)
})
