import assert from 'node:assert/strict'
import test from 'node:test'
import type { Tables } from '@garsonless/db/types'
import { getMissingProductFields, getMissingProductInfo } from './menu-manager-utils'

const item = (overrides: Partial<Tables<'menu_items'>> = {}) => ({
  description: 'Tereyağlı', images: ['a.webp'], ingredients: [{ name: 'Yumurta' }], energy_kcal: 320,
  food_info_reviewed_at: '2026-10-01T00:00:00.000Z', ...overrides,
}) as Tables<'menu_items'>

test('a complete product reports nothing missing', () => {
  assert.deepEqual(getMissingProductFields(item()), [])
})

test('each gap names its field and a consequence the owner can act on', () => {
  const missing = getMissingProductFields(item({ images: [], energy_kcal: null }))
  assert.deepEqual(missing.map((entry) => entry.field), ['image', 'energy'])
  assert.ok(missing.every((entry) => entry.consequence.length > 0))
  assert.deepEqual(getMissingProductInfo(item({ images: [] })), ['Görsel'])
})

test('the food-info review is flagged as an internal check, not a guest effect', () => {
  const [review] = getMissingProductFields(item({ food_info_reviewed_at: null }))
  assert.equal(review?.field, 'review')
  assert.match(review?.consequence ?? '', /^İç kontrol/)
})
