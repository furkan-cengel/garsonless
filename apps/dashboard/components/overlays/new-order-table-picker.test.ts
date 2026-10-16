import assert from 'node:assert/strict'
import test from 'node:test'
import { sortTablesForPicker } from './new-order-table-picker'

const tables = ['Masa 8', 'Masa 6', 'Teras 1', 'Masa 10', 'Masa 3', 'Masa 4'].map((label) => ({ label }))

test('tables sort naturally by label', () => {
  assert.deepEqual(sortTablesForPicker(tables).map((t) => t.label), ['Masa 3', 'Masa 4', 'Masa 6', 'Masa 8', 'Masa 10', 'Teras 1'])
})

test('search narrows by Turkish-aware label match without mutating the input', () => {
  assert.deepEqual(sortTablesForPicker(tables, ' teRAS ').map((t) => t.label), ['Teras 1'])
  assert.equal(tables[0]!.label, 'Masa 8')
})
