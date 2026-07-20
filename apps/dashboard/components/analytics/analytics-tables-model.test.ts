import assert from 'node:assert/strict'
import test from 'node:test'
import type { TableReportRow } from '../../lib/queries/analytics'
import { formatTableDwell, projectTablesReport } from './analytics-tables-model'

function table(overrides: Partial<TableReportRow>): TableReportRow {
  return {
    id: 'table-1',
    label: 'Masa 1',
    revenue: 0,
    orders: 0,
    turnover: 0,
    avgDwellMinutes: null,
    openNow: false,
    ...overrides,
  }
}

test('table report projection keeps revenue, payment, turn and open-session meanings separate', () => {
  const source = [
    table({ id: 'a', label: 'Masa A', revenue: 100, orders: 2, turnover: 2, avgDwellMinutes: 30 }),
    table({ id: 'b', label: 'Masa B', revenue: 200, orders: 3, turnover: 1, avgDwellMinutes: 90, openNow: true }),
    table({ id: 'c', label: 'Masa C' }),
  ]
  const sourceOrder = source.map((row) => row.id)

  const report = projectTablesReport(source)

  assert.deepEqual(report.sortedTables.map((row) => row.id), ['b', 'a', 'c'])
  assert.equal(report.maxRevenue, 200)
  assert.equal(report.totalRevenue, 300)
  assert.equal(report.totalOrders, 5)
  assert.equal(report.activeTables, 2)
  assert.equal(report.openNowCount, 1)
  assert.equal(report.totalTurnover, 3)
  assert.equal(report.averageRevenue, 150)
  assert.equal(report.overallDwell, 50)
  assert.deepEqual(source.map((row) => row.id), sourceOrder)
})

test('empty table metrics fail closed instead of fabricating occupancy or averages', () => {
  const report = projectTablesReport([table({ id: 'empty' })])

  assert.equal(report.maxRevenue, 1)
  assert.equal(report.averageRevenue, null)
  assert.equal(report.overallDwell, null)
  assert.equal(report.openNowCount, 0)
  assert.equal(report.totalTurnover, 0)
})

test('table dwell labels keep minute and hour formatting stable', () => {
  assert.equal(formatTableDwell(null), '—')
  assert.equal(formatTableDwell(42), '42dk')
  assert.equal(formatTableDwell(60), '1s 00dk')
  assert.equal(formatTableDwell(125), '2s 05dk')
})
