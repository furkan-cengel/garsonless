import assert from 'node:assert/strict'
import test from 'node:test'

import type { MenuItem } from '../../../menu/types'
import { resolveFeaturedScrollItemCount, resolveFeaturedScrollItems } from './featuredScrollModel'

const item = (id: string, position: number, isAvailable = true): MenuItem => ({
  id,
  category_id: 'category',
  name: id,
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

test('featured item count remains inside the supported two-to-eight range', () => {
  assert.equal(resolveFeaturedScrollItemCount('1'), 2)
  assert.equal(resolveFeaturedScrollItemCount('6'), 6)
  assert.equal(resolveFeaturedScrollItemCount('30'), 8)
  assert.equal(resolveFeaturedScrollItemCount('invalid'), 4)
})

test('featured automatic selection prioritizes the server sales ranking and fills from menu order', () => {
  const items = [item('third', 3), item('hidden', 0, false), item('first', 1), item('second', 2)]
  items[0]!.featuredRank = 1
  items[3]!.featuredRank = 0
  assert.deepEqual(
    resolveFeaturedScrollItems({ itemCount: '3' }, items).map(({ id }) => id),
    ['second', 'third', 'first'],
  )
})

test('featured automatic selection keeps catalog order when no sales ranking exists', () => {
  const items = [item('third', 3), item('first', 1), item('second', 2)]
  assert.deepEqual(
    resolveFeaturedScrollItems({ itemCount: '2' }, items).map(({ id }) => id),
    ['first', 'second'],
  )
})

test('featured selection stays automatic even for legacy manual section rows', () => {
  const items = [item('one', 0), item('two', 1), item('hidden', 2, false), item('three', 3)]
  items[1]!.featuredRank = 0
  assert.deepEqual(
    resolveFeaturedScrollItems({
      selectionMode: 'manual',
      itemCount: '4',
      item1Id: 'three',
      item2Id: 'hidden',
      item3Id: 'one',
      item4Id: 'three',
      item5Id: 'two',
    }, items).map(({ id }) => id),
    ['two', 'one', 'three'],
  )
})
