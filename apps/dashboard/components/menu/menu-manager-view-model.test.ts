import assert from 'node:assert/strict'
import test from 'node:test'
import type { Tables } from '@garsonless/db'
import { deriveMenuManagerView } from './menu-manager-view-model'

const categories = [
  { id: 'coffee', name: 'Kahve', parent_id: null },
  { id: 'matcha', name: 'Matcha', parent_id: 'coffee' },
  { id: 'dessert', name: 'Tatlı', parent_id: null },
] as Tables<'menu_categories'>[]

const items = [
  { id: 'filter', name: 'Filtre Kahve', description: 'Sade', category_id: 'coffee' },
  { id: 'latte', name: 'Matcha Latte', description: 'Yulaf sütlü', category_id: 'matcha' },
  { id: 'cake', name: 'Cheesecake', description: 'Frambuazlı', category_id: 'dessert' },
] as Tables<'menu_items'>[]

test('top-level selection includes its direct sub-category products', () => {
  const view = deriveMenuManagerView({
    categories,
    items,
    activeCategoryId: 'coffee',
    activeSubCategoryId: null,
    selectedItem: null,
    search: '',
  })

  assert.deepEqual(view.visibleItems.map((item) => item.id), ['filter', 'latte'])
  assert.deepEqual(view.subCategories.map((category) => category.id), ['matcha'])
  assert.equal(view.navigationActiveId, 'coffee')
})

test('sub-category selection narrows products and navigation highlight', () => {
  const view = deriveMenuManagerView({
    categories,
    items,
    activeCategoryId: 'coffee',
    activeSubCategoryId: 'matcha',
    selectedItem: null,
    search: '',
  })

  assert.deepEqual(view.visibleItems.map((item) => item.id), ['latte'])
  assert.equal(view.navigationActiveId, 'matcha')
})

test('search spans categories and exposes matched category ids', () => {
  const view = deriveMenuManagerView({
    categories,
    items,
    activeCategoryId: 'coffee',
    activeSubCategoryId: null,
    selectedItem: items[2]!,
    search: 'frambuaz',
  })

  assert.deepEqual(view.visibleItems.map((item) => item.id), ['cake'])
  assert.deepEqual([...view.searchMatchedCategoryIds!], ['dessert'])
  assert.equal(view.activeCategoryForPanel?.id, 'dessert')
})
