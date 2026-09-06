import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bulkImportRowSchema, menuImportRowErrors, parseCsvBoolean } from '../../lib/menu-import-validation'

const row = { sourceRow: 2, category: 'İçecekler', name: 'Çay', description: '', price: 10,
  ingredients: [], energyKcal: null, mayContainAllergens: [], containsAlcohol: false, containsPork: false }
test('CSV preview and server reject the same overlong fields', () => {
  for (const [field, value] of [['name', 'a'.repeat(101)], ['description', 'a'.repeat(501)], ['category', 'a'.repeat(101)]]) {
    const invalid = { ...row, [field!]: value }
    assert.equal(bulkImportRowSchema.safeParse(invalid).success, false)
    assert.equal(menuImportRowErrors(invalid).length, 1)
  }
  assert.deepEqual(menuImportRowErrors(row), [])
})
test('boolean CSV values are explicit and typos never silently pass', () => {
  for (const value of ['EVET', 'true', '1']) assert.deepEqual(parseCsvBoolean(value, 'Alkol'), { value: true })
  for (const value of ['', 'Hayır', 'HAYIR', 'hayir', 'false', '0']) assert.deepEqual(parseCsvBoolean(value, 'Alkol'), { value: false })
  assert.match(parseCsvBoolean('evett', 'Alkol').error!, /Alkol/)
  assert.match(parseCsvBoolean('yes', 'Domuz Kaynaklı').error!, /Domuz Kaynaklı/)
})
