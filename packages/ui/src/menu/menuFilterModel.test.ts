import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_THEME } from '@garsonless/design-engine'
import { itemMatchesMenuFilters, resolveMenuFilterDefinitions } from './menuFilterModel'
import type { MenuItem } from './types'

const item = {
  id: 'item-1',
  is_vegan: true,
  is_vegetarian: true,
  is_halal: false,
} as MenuItem

test('menu filter definitions preserve enabled presets and product-backed manual filters', () => {
  const definitions = resolveMenuFilterDefinitions({
    ...DEFAULT_THEME,
    menuFilterPresetIds: ['vegan', 'halal'],
    menuCustomFilters: [
      { id: 'manual-spicy', label: ' Acılı ', itemIds: ['item-1', 'item-1'] },
      { id: 'manual-empty', label: 'Henüz boş', itemIds: [] },
    ],
  })

  assert.deepEqual(definitions, [
    { id: 'vegan', label: 'Vegan', kind: 'preset' },
    { id: 'halal', label: 'Helal', kind: 'preset' },
    { id: 'manual-spicy', label: 'Acılı', kind: 'custom', itemIds: ['item-1'] },
  ])
})

test('preset and manual menu filters share the same AND filtering contract', () => {
  assert.equal(itemMatchesMenuFilters(item, [
    { id: 'vegan', label: 'Vegan', kind: 'preset' },
    { id: 'manual-spicy', label: 'Acılı', kind: 'custom', itemIds: ['item-1'] },
  ]), true)
  assert.equal(itemMatchesMenuFilters(item, [
    { id: 'halal', label: 'Helal', kind: 'preset' },
  ]), false)
  assert.equal(itemMatchesMenuFilters(item, [
    { id: 'manual-spicy', label: 'Acılı', kind: 'custom', itemIds: ['item-2'] },
  ]), false)
})
