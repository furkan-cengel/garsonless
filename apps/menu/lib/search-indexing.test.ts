import assert from 'node:assert/strict'
import test from 'node:test'
import { excludedRestaurantIds, hasIndexableStorefront, isRestaurantIndexable, menuCanonicalPath, privateMenuPath } from './search-indexing.ts'

const id = '4bc2978d-7e9a-4da7-8d00-f54884264f58'
test('only explicitly excluded stable IDs are noindex, regardless of slug changes', () => {
  assert.equal(isRestaurantIndexable(id, id.toUpperCase()), false)
  assert.equal(isRestaurantIndexable('19f18c37-f2a4-44e4-8dc4-d84d8ebed80b', id), true)
  assert.equal(excludedRestaurantIds(` ${id},${id} `).size, 1)
  assert.throws(() => excludedRestaurantIds('demetest'), /UUID/)
})
test('canonical menu route agrees with whether the storefront is actually served', () => {
  assert.equal(menuCanonicalPath('kafe', true, hasIndexableStorefront(true, false)), '/kafe')
  assert.equal(menuCanonicalPath('kafe', true, hasIndexableStorefront(false, true)), '/kafe')
  assert.equal(menuCanonicalPath('kafe', true, hasIndexableStorefront(true, true)), '/kafe/menu')
  assert.equal(menuCanonicalPath('kafe', false, true), '/kafe')
})
test('preview query order and table sessions never become indexable; UTM stays public', () => {
  assert.equal(privateMenuPath('/cafe/menu', new URLSearchParams('x=1&preview=1')), true)
  assert.equal(privateMenuPath('/cafe/table/table-id', new URLSearchParams()), true)
  assert.equal(privateMenuPath('/theme-preview/cafe', new URLSearchParams()), true)
  assert.equal(privateMenuPath('/cafe/menu', new URLSearchParams('utm_source=google')), false)
})
