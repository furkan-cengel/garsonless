import assert from 'node:assert/strict'
import test from 'node:test'

import type { MenuItem } from './types'
import { hasConfigurableModifierGroups, isProductConfigurable } from './productConfiguration'

function item(overrides: Partial<Pick<MenuItem, 'modifier_groups' | 'ingredients'>> = {}) {
  return {
    modifier_groups: [],
    ingredients: [],
    ...overrides,
  } as Pick<MenuItem, 'modifier_groups' | 'ingredients'>
}

test('empty or non-selectable modifier groups do not advertise configuration', () => {
  const candidate = item({
    modifier_groups: [{ id: 'stale', name: 'Eski grup', min: 0, max: 0, required: false, selection_mode: 'single', options: [] }],
  })
  assert.equal(hasConfigurableModifierGroups(candidate), false)
  assert.equal(isProductConfigurable(candidate), false)
})

test('selectable modifiers and removable ingredients require configuration', () => {
  const withModifier = item({
    modifier_groups: [{
      id: 'size',
      name: 'Boyut',
      min: 1,
      max: 1,
      required: true,
      selection_mode: 'single',
      options: [{ id: 'large', name: 'Büyük', price_delta: 20, is_default: false, allergen_codes: [], calorie_delta: 0 }],
    }],
  })
  const withRemoval = item({
    ingredients: [{ id: 'pickle', name: 'Turşu', removable: true, allergen_codes: [] }],
  })
  assert.equal(isProductConfigurable(withModifier), true)
  assert.equal(isProductConfigurable(withRemoval), true)
})
