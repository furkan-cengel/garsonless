import assert from 'node:assert/strict'
import test from 'node:test'

import type { MenuItem } from '../../../menu/types'
import { inspectChefPickSelection, resolveChefPickItemCount, resolveChefPickItems } from './chefPickModel'

const item = (id: string, position: number, isAvailable = true): MenuItem => ({
  id,
  category_id: 'category-1',
  name: `Product ${id}`,
  description: null,
  price: 100,
  images: [],
  ingredients: [],
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
  modifier_groups: [],
  is_available: isAvailable,
  position,
})

test('automatic chef picks use available menu order and clamp item count', () => {
  const items = [item('late', 4), item('hidden', 0, false), item('first', 1), item('second', 2), item('third', 3)]

  assert.equal(resolveChefPickItemCount('0'), 1)
  assert.equal(resolveChefPickItemCount('9'), 4)
  assert.equal(resolveChefPickItemCount('invalid'), 3)
  assert.deepEqual(
    resolveChefPickItems({ itemCount: '2' }, items).map(({ id }) => id),
    ['first', 'second'],
  )
})

test('manual chef picks preserve configured order and reject unavailable or duplicate items', () => {
  const items = [item('one', 1), item('two', 2), item('hidden', 3, false), item('four', 4)]

  assert.deepEqual(
    resolveChefPickItems({
      selectionMode: 'manual',
      itemCount: '4',
      item1Id: 'two',
      item2Id: 'hidden',
      item3Id: 'two',
      item4Id: 'one',
    }, items).map(({ id }) => id),
    ['two', 'one'],
  )
})

test('manual chef pick inspection distinguishes duplicate, unavailable and missing selections', () => {
  const inspection = inspectChefPickSelection({
    selectionMode: 'manual',
    itemCount: '4',
    item1Id: 'one',
    item2Id: 'one',
    item3Id: 'hidden',
    item4Id: 'removed',
  }, [item('one', 1), item('hidden', 2, false)])

  assert.deepEqual(inspection.items.map(({ id }) => id), ['one'])
  assert.deepEqual(inspection.issues.map(({ type }) => type), ['duplicate', 'unavailable', 'missing'])
  assert.equal(inspection.requestedCount, 4)
})
