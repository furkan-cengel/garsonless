import assert from 'node:assert/strict'
import test from 'node:test'
import { groupTablesForPicker, sortTablesForPicker, tableAreas } from './new-order-table-picker'

const tables = ['Masa 8', 'Masa 6', 'Teras 1', 'Masa 10', 'Masa 3', 'Masa 4'].map((label) => ({ label }))

test('tables sort naturally by label', () => {
  assert.deepEqual(sortTablesForPicker(tables).map((t) => t.label), ['Masa 3', 'Masa 4', 'Masa 6', 'Masa 8', 'Masa 10', 'Teras 1'])
})

test('search narrows by Turkish-aware label match without mutating the input', () => {
  assert.deepEqual(sortTablesForPicker(tables, ' teRAS ').map((t) => t.label), ['Teras 1'])
  assert.equal(tables[0]!.label, 'Masa 8')
})

test('tables are grouped by floor area, unnamed areas last, and a single area shows no tabs', () => {
  const tables = [
    { label: 'Bahçe 2', areaLabel: 'Bahçe' },
    { label: 'Masa 10', areaLabel: 'Salon' },
    { label: 'Masa 2', areaLabel: 'Salon' },
    { label: 'Bar 1', areaLabel: null },
  ]
  assert.deepEqual(tableAreas(tables), ['Bahçe', 'Salon', 'Diğer'])
  assert.deepEqual(groupTablesForPicker(tables, '', null).map((group) => [group.area, group.tables.map((t) => t.label)]), [
    ['Bahçe', ['Bahçe 2']], ['Salon', ['Masa 2', 'Masa 10']], ['Diğer', ['Bar 1']],
  ])
  assert.deepEqual(groupTablesForPicker(tables, '', 'Salon').map((group) => group.area), ['Salon'])
  assert.deepEqual(groupTablesForPicker(tables, 'yok', null), [])
  assert.deepEqual(tableAreas([{ label: 'Masa 1', areaLabel: 'Salon' }]), [])
  assert.deepEqual(groupTablesForPicker([{ label: 'Masa 1', areaLabel: null }], '', null), [{ area: null, tables: [{ label: 'Masa 1', areaLabel: null }] }])
})
