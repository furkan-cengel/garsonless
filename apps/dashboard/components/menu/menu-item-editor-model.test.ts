import assert from 'node:assert/strict'
import test from 'node:test'

import { isMenuItemEditorDirty, type MenuItemEditorSnapshot } from './menu-item-editor-model'

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
