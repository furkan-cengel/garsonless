import assert from 'node:assert/strict'
import test from 'node:test'
import type { ProductReportItem } from '../../lib/queries/analytics'
import {
  formatProductDelta,
  projectProductReport,
  selectProductMovers,
} from './analytics-items-model'

function product(overrides: Partial<ProductReportItem>): ProductReportItem {
  return {
    name: 'Ürün',
    count: 1,
    revenue: 10,
    sharePct: 0,
    cumulativePct: 0,
    abcClass: 'C',
    deltaPct: 0,
    ...overrides,
  }
}

test('product report projection derives KPI and ABC totals in one pass', () => {
  const projection = projectProductReport([
    product({ name: 'A', count: 3, revenue: 120, abcClass: 'A' }),
    product({ name: 'B', count: 2, revenue: 50, abcClass: 'B' }),
    product({ name: 'C', count: 1, revenue: 30, abcClass: 'C' }),
  ])

  assert.deepEqual(projection, {
    totalRevenue: 200,
    totalCount: 6,
    productCount: 3,
    classTotals: { A: 120, B: 50, C: 30 },
  })
})

test('product movers preserve new/rising and falling audit semantics without mutating input', () => {
  const items = [
    product({ name: 'Sabit', deltaPct: 0 }),
    product({ name: 'Yeni', deltaPct: null }),
    product({ name: 'Yükselen', deltaPct: 80 }),
    product({ name: 'Az düşen', deltaPct: -10 }),
    product({ name: 'Çok düşen', deltaPct: -60 }),
  ]
  const originalOrder = items.map((item) => item.name)

  const movers = selectProductMovers(items)

  assert.deepEqual(movers.risers.map((item) => item.name), ['Yeni', 'Yükselen'])
  assert.deepEqual(movers.fallers.map((item) => item.name), ['Çok düşen', 'Az düşen'])
  assert.deepEqual(items.map((item) => item.name), originalOrder)
})

test('product delta labels distinguish new, positive, zero and negative values', () => {
  assert.equal(formatProductDelta(null), 'Yeni')
  assert.equal(formatProductDelta(12.5), '+12,5%')
  assert.equal(formatProductDelta(0), '+0%')
  assert.equal(formatProductDelta(-8), '-8%')
})
