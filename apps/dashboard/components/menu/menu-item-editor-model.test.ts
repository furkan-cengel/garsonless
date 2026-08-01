import assert from 'node:assert/strict'
import test from 'node:test'

import {
  isMenuItemEditorDirty,
  isNewMenuItemDraftDirty,
  type MenuItemEditorSnapshot,
  type NewMenuItemDraftSnapshot,
} from './menu-item-editor-model'

const initial: MenuItemEditorSnapshot = {
  name: 'Latte',
  description: '',
  price: '65',
  cost: '',
  vatMode: 'category',
  vatRate: '10',
  stationMode: 'category',
  kitchenStationId: 'bar',
  isAvailable: true,
  earnsStamp: false,
  nutrition: { calories: null, reviewed: false },
  images: [],
  modifiers: [],
}

test('unchanged snapshot is clean', () => {
  assert.equal(isMenuItemEditorDirty({ ...initial }, initial), false)
})

test('inherited VAT and station backing values do not create false dirty state', () => {
  assert.equal(isMenuItemEditorDirty({
    ...initial,
    vatRate: '20',
    kitchenStationId: 'kitchen',
  }, initial), false)
})

test('custom VAT and station changes are tracked', () => {
  assert.equal(isMenuItemEditorDirty({ ...initial, vatMode: 'custom', vatRate: '20' }, initial), true)
  assert.equal(isMenuItemEditorDirty({ ...initial, stationMode: 'custom', kitchenStationId: 'kitchen' }, initial), true)
})

test('nested nutrition, image and modifier changes are tracked', () => {
  assert.equal(isMenuItemEditorDirty({ ...initial, nutrition: { calories: 90, reviewed: false } }, initial), true)
  assert.equal(isMenuItemEditorDirty({ ...initial, images: ['latte.jpg'] }, initial), true)
  assert.equal(isMenuItemEditorDirty({ ...initial, modifiers: [{ id: 'milk' }] }, initial), true)
})

const newItemInitial: NewMenuItemDraftSnapshot = {
  name: '',
  description: '',
  price: '',
  cost: '',
  isAvailable: true,
  earnsStamp: false,
  stationMode: 'category',
  kitchenStationId: 'bar',
  nutrition: { ingredients: [{ id: 'stable-empty-row', name: '' }] },
}

test('untouched new-product draft is clean with a stable nutrition baseline', () => {
  assert.equal(isNewMenuItemDraftDirty({ ...newItemInitial }, newItemInitial), false)
})

test('new-product draft tracks every persisted field but ignores inherited station backing values', () => {
  assert.equal(isNewMenuItemDraftDirty({ ...newItemInitial, description: 'Yoğun' }, newItemInitial), true)
  assert.equal(isNewMenuItemDraftDirty({ ...newItemInitial, isAvailable: false }, newItemInitial), true)
  assert.equal(isNewMenuItemDraftDirty({ ...newItemInitial, kitchenStationId: 'kitchen' }, newItemInitial), false)
  assert.equal(isNewMenuItemDraftDirty({ ...newItemInitial, stationMode: 'custom', kitchenStationId: 'kitchen' }, newItemInitial), true)
  assert.equal(isNewMenuItemDraftDirty({ ...newItemInitial, nutrition: { ingredients: [{ id: 'stable-empty-row', name: 'Süt' }] } }, newItemInitial), true)
})
