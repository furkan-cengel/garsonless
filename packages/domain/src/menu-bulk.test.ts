import assert from 'node:assert/strict'
import test from 'node:test'
import { applyMenuBulkRule, bulkPrice, menuBulkPatches, validateMenuBulkPatches, type MenuBulkItem } from './menu-bulk'
const item: MenuBulkItem = { id: 'one', name: 'Türk Kahvesi', description: null, price: 125.55, category_id: 'category', is_available: true, updated_at: '2026-09-17T00:00:00Z' }
test('bulk prices parse Turkish decimals and reject invalid/overflow/negative values', () => {
  assert.equal(bulkPrice('1.234,56'), 1234.56)
  assert.equal(bulkPrice('0,01'), .01)
  for (const value of ['', '-1', 'NaN', '0', '100000000', '1,234', 'Infinity']) assert.throws(() => bulkPrice(value))
})
test('percentage/fixed rules round once using decimal integer arithmetic', () => {
  const price = (mode: 'percent-up' | 'percent-down' | 'add' | 'subtract' | 'set', value: string, rounding: 1 | 100 | 500 | 1000 = 1) => applyMenuBulkRule(item, { field: 'price', mode, value, rounding }).price
  assert.equal(price('percent-up', '10'), 138.11)
  assert.equal(price('percent-down', '10'), 113)
  assert.equal(price('add', '0,45'), 126)
  assert.equal(price('subtract', '25,55'), 100)
  assert.equal(price('set', '127,50', 500), 130)
  assert.equal(price('set', '125', 1000), 130)
  assert.equal(price('set', '124,49', 100), 124)
  assert.throws(() => price('percent-down', '100'))
  assert.throws(() => price('set', '0,01', 100))
})
test('literal text rules, clear description, no-match and manual overrides', () => {
  let next = applyMenuBulkRule(item, { field: 'name', mode: 'replace', find: 'Türk', value: 'Osmanlı' })
  next = applyMenuBulkRule(next, { field: 'name', mode: 'prefix', value: 'Özel ' })
  next = { ...next, name: 'Elle düzenlendi' }
  assert.equal(menuBulkPatches([item], [next])[0]?.changes.name, 'Elle düzenlendi')
  assert.equal(applyMenuBulkRule(item, { field: 'description', mode: 'set', value: 'Yeni' }).description, 'Yeni')
  assert.equal(applyMenuBulkRule(item, { field: 'description', mode: 'clear', value: '' }).description, null)
  assert.deepEqual(menuBulkPatches([item], [applyMenuBulkRule(item, { field: 'name', mode: 'replace', find: 'türk', value: 'Yeni' })]), [])
  assert.throws(() => applyMenuBulkRule(item, { field: 'name', mode: 'replace', find: '', value: 'Yeni' }))
})
test('only changed fields cross the boundary; invalid rows and duplicate IDs fail', () => {
  const patches = menuBulkPatches([item], [{ ...item, price: 200, category_id: 'other', is_available: false }])
  assert.deepEqual(patches[0], { id: item.id, expectedUpdatedAt: item.updated_at, changes: { price: 200, category_id: 'other', is_available: false } })
  assert.equal(validateMenuBulkPatches(patches), null)
  assert.ok(validateMenuBulkPatches([...patches, ...patches]))
  for (const changes of [{ name: ' ' }, { description: 'x'.repeat(501) }, { price: 1.123 }, { price: Infinity }, { name: 'x'.repeat(101) }]) assert.ok(validateMenuBulkPatches([{ id: '1', expectedUpdatedAt: item.updated_at, changes }]))
})
