import assert from 'node:assert/strict'
import test from 'node:test'
import {
  aggregateCollectedFinancials,
  foldOrderItemsToNet,
  summarizeCancelledFinancials,
} from '../../lib/analytics-financial-model'

test('product allocation reconciles an order-level discount to the kuruş', () => {
  const result = foldOrderItemsToNet([{
    total: 80,
    items: [
      { name: 'A', price: 60, quantity: 1 },
      { name: 'B', price: 40, quantity: 1 },
    ],
  }])

  assert.deepEqual(result.get('A'), { count: 1, revenue: 48 })
  assert.deepEqual(result.get('B'), { count: 1, revenue: 32 })
  assert.equal([...result.values()].reduce((sum, item) => sum + item.revenue, 0), 80)
})

test('rounding residue is deterministic and product totals remain exact', () => {
  const result = foldOrderItemsToNet([{
    total: 1,
    items: [
      { name: 'A', price: 1, quantity: 1 },
      { name: 'B', price: 1, quantity: 1 },
      { name: 'C', price: 1, quantity: 1 },
    ],
  }])

  assert.deepEqual([...result.values()].map((item) => item.revenue), [0.34, 0.33, 0.33])
  assert.equal([...result.values()].reduce((sum, item) => sum + item.revenue, 0), 1)
})

test('amount above item gross is not mislabeled as product revenue', () => {
  const result = foldOrderItemsToNet([{
    total: 110,
    items: [{ name: 'A', price: 100, quantity: 1 }],
  }])
  const summary = aggregateCollectedFinancials([{
    total: 110,
    items: [{ name: 'A', price: 100, quantity: 1, vatRate: 10 }],
  }])

  assert.equal(result.get('A')?.revenue, 100)
  assert.equal(summary.grossSales, 100)
  assert.equal(summary.netSales, 110)
  assert.equal(summary.unattributedAmount, 10)
})

test('financial summary exposes gross, discount, net and VAT without inventing unknown VAT', () => {
  const summary = aggregateCollectedFinancials([{
    total: 90,
    items: [
      { name: 'Known', price: 55, quantity: 1, vatRate: 10 },
      { name: 'Unknown', price: 45, quantity: 1 },
    ],
  }])

  assert.equal(summary.grossSales, 100)
  assert.equal(summary.discountTotal, 10)
  assert.equal(summary.netSales, 90)
  assert.equal(summary.vatTotal, 4.5)
  assert.equal(summary.netOfVatTotal, 45)
  assert.equal(summary.unknownVatGross, 40.5)
  assert.equal(summary.unattributedAmount, 0)
})

test('paid and comp cancellations are never mislabeled as uncollected loss', () => {
  const summary = summarizeCancelledFinancials([
    { total: 100, paidAt: null, paymentMethod: null },
    { total: 80, paidAt: '2026-07-30T10:00:00Z', paymentMethod: 'cash' },
    { total: 60, paidAt: '2026-07-30T10:00:00Z', paymentMethod: 'pos' },
    { total: 40, paidAt: '2026-07-30T10:00:00Z', paymentMethod: 'comp' },
    { total: 20, paidAt: null, paymentMethod: 'comp' },
  ])

  assert.deepEqual(summary, {
    lostAmount: 100,
    collectedCancelledCount: 2,
    collectedCancelledAmount: 140,
    compCancelledCount: 2,
    compCancelledAmount: 60,
  })
})
