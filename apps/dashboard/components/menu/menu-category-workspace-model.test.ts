import assert from 'node:assert/strict'
import test from 'node:test'

import type { Tables } from '@garsonless/db/types'
import {
  collectCategoryTreeIds,
  countCategoryTreeItems,
  deriveCategoryWorkspaceView,
  mergeTopLevelCategoryOrder,
} from './menu-category-workspace-model'

type Category = Tables<'menu_categories'>
type MenuItem = Tables<'menu_items'>

const categories = [
  { id: 'coffee', name: 'Kahve', parent_id: null },
  { id: 'matcha', name: 'Matcha', parent_id: 'coffee' },
  { id: 'ceremonial', name: 'Seremoni', parent_id: 'matcha' },
  { id: 'dessert', name: 'Tatlı', parent_id: null },
] as unknown as Category[]

const items = [
  { id: 'one', category_id: 'coffee', is_available: true },
  { id: 'two', category_id: 'matcha', is_available: false },
  { id: 'three', category_id: 'dessert', is_available: true },
] as unknown as MenuItem[]

test('search keeps a parent visible when only its child matches', () => {
  const view = deriveCategoryWorkspaceView({
    categories,
    items,
    activeId: 'matcha',
    visibleCategoryIds: new Set(['matcha']),
  })
  assert.deepEqual(view.topLevel.map((category) => category.id), ['coffee'])
  assert.equal(view.activeTopId, 'coffee')
  assert.deepEqual(
    [view.totalItems, view.availableItems, view.unavailableItems],
    [3, 2, 1],
  )
})

test('category deletion scope includes every descendant', () => {
  assert.deepEqual(collectCategoryTreeIds(categories, 'coffee'), [
    'coffee',
    'matcha',
    'ceremonial',
  ])
})

test('top-level reorder preserves children and unknown top-level categories', () => {
  assert.deepEqual(
    mergeTopLevelCategoryOrder(categories, ['dessert']).map((category) => category.id),
    ['dessert', 'coffee', 'matcha', 'ceremonial'],
  )
})

test('category delete guard counts products in the whole sub-category tree', () => {
  assert.equal(countCategoryTreeItems(categories, items, 'coffee'), 2)
  assert.equal(countCategoryTreeItems(categories, items, 'ceremonial'), 0)
})
