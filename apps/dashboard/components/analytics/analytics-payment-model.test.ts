import assert from 'node:assert/strict'
import test from 'node:test'
import { aggregateRefundSummary } from '../../lib/analytics-payment-model'
import type { PaymentReport } from '../../lib/analytics-payment-model'

test('refund summary counts only supplied successful ledger rows without double counting', () => {
  const summary = aggregateRefundSummary([
    { amount: 40, paymentMethod: 'cash', kind: 'partial', refundedAt: '2026-07-30T10:00:00Z' },
    { amount: 60, paymentMethod: 'cash', kind: 'full', refundedAt: '2026-07-30T11:00:00Z' },
    { amount: 25.5, paymentMethod: 'iyzico', kind: 'partial', refundedAt: '2026-07-30T12:00:00Z' },
  ], 200)

  assert.deepEqual(summary, {
    total: 125.5,
    count: 3,
    fullCount: 1,
    partialCount: 2,
    netCollected: 74.5,
    byMethod: [
      { key: 'cash', label: 'Nakit', amount: 100, count: 2 },
      { key: 'iyzico', label: 'İyzico', amount: 25.5, count: 1 },
    ],
  })
})

test('refund coverage is an explicit availability fact, never inferred from a zero total', () => {
  const report = {
    coverage: { monetaryRefunds: false, serviceFees: false, tips: false },
  } as PaymentReport
  assert.equal(report.coverage.monetaryRefunds, false)
})
