import assert from 'node:assert/strict'
import test from 'node:test'
import type { Tables } from '@garsonless/db'
import { patchMenuItemCollection, removeCategoryTreeFromMenu } from './menu-manager-command-model'

const categories = [
  { id: 'coffee', parent_id: null, name: 'Kahve' },
  { id: 'matcha', parent_id: 'coffee', name: 'Matcha' },
  { id: 'ceremony', parent_id: 'matcha', name: 'Seremoni' },
  { id: 'dessert', parent_id: null, name: 'Tatlı' },
] as Tables<'menu_categories'>[]

const items = [
  { id: 'latte', category_id: 'coffee', name: 'Latte', price: 65, is_available: true },
  { id: 'matcha-latte', category_id: 'matcha', name: 'Matcha Latte', price: 75, is_available: true },
  { id: 'cake', category_id: 'dessert', name: 'Kek', price: 90, is_available: true },
] as Tables<'menu_items'>[]

test('kategori ağacı silme bütün alt kategorileri ve ürünleri kaldırıp aktif kategoriyi taşır', () => {
  const next = removeCategoryTreeFromMenu({ categories, items, activeCategory: 'coffee' }, 'coffee')

  assert.deepEqual(next.categories.map((category) => category.id), ['dessert'])
  assert.deepEqual(next.items.map((item) => item.id), ['cake'])
  assert.equal(next.activeCategory, 'dessert')
})

test('hedef dışı kategori silinince aktif kategori korunur', () => {
  const next = removeCategoryTreeFromMenu({ categories, items, activeCategory: 'coffee' }, 'dessert')

  assert.equal(next.activeCategory, 'coffee')
  assert.deepEqual(next.items.map((item) => item.id), ['latte', 'matcha-latte'])
})

test('ürün patch projection yalnız hedef liste ve seçili ürün snapshotını günceller', () => {
  const next = patchMenuItemCollection(items, items[0] ?? null, 'latte', { price: 70, is_available: false })

  assert.deepEqual(next.items.map(({ id, price, is_available }) => ({ id, price, is_available })), [
    { id: 'latte', price: 70, is_available: false },
    { id: 'matcha-latte', price: 75, is_available: true },
    { id: 'cake', price: 90, is_available: true },
  ])
  assert.equal(next.selectedItem?.price, 70)
  assert.equal(next.items[1], items[1])
})
