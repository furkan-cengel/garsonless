import assert from 'node:assert/strict'
import test from 'node:test'
import { getMenuCategoryIconKey } from './menuCategoryIconModel'

test('maps the generated café icon set to Turkish menu categories', () => {
  assert.equal(getMenuCategoryIconKey('Kahvaltı'), 'breakfast')
  assert.equal(getMenuCategoryIconKey('İçecekler'), 'drinks')
  assert.equal(getMenuCategoryIconKey('Kahveler'), 'coffee')
  assert.equal(getMenuCategoryIconKey('Kokteyller'), 'cocktails')
  assert.equal(getMenuCategoryIconKey('Fresh İçecekler'), 'fresh-drinks')
  assert.equal(getMenuCategoryIconKey('Matchalar'), 'matcha')
  assert.equal(getMenuCategoryIconKey('Tatlılar'), 'desserts')
  assert.equal(getMenuCategoryIconKey('Ekstralar'), 'extras')
})

test('uses specific child-category matches before the generic drinks match', () => {
  assert.equal(getMenuCategoryIconKey('Fresh içecekler'), 'fresh-drinks')
  assert.equal(getMenuCategoryIconKey('Kahve içecekleri'), 'coffee')
})

test('returns null for categories outside the generated set', () => {
  assert.equal(getMenuCategoryIconKey('Ana Yemekler'), null)
})
