import assert from 'node:assert/strict'
import test from 'node:test'
import { projectPaymentAggregate } from '../../lib/analytics-payment-aggregate'

test('payment aggregate preserves collected, comp, refund and net meanings', () => {
  const report = projectPaymentAggregate({
    groups: [
      { paymentMethod: 'cash', amount: 120, count: 2 },
      { paymentMethod: null, amount: 30, count: 1 },
      { paymentMethod: 'comp', amount: 20, count: 1 },
    ],
    financials: {
      grossSales: 160, discountTotal: 10, netSales: 150, vatTotal: 12,
      netOfVatTotal: 108, unknownVatGross: 30, unattributedAmount: 0,
    },
    refunds: {
      total: 40, count: 1, fullCount: 0, partialCount: 1,
      groups: [{ paymentMethod: 'cash', amount: 40, count: 1 }],
    },
  })

  assert.equal(report.collectedTotal, 150)
  assert.equal(report.collectedCount, 3)
  assert.deepEqual(report.comp, { amount: 20, count: 1 })
  assert.equal(report.refunds.netCollected, 110)
  assert.equal(report.collected.find((group) => group.key === 'unknown')?.label, 'Bilinmiyor (eski)')
  assert.deepEqual(report.financials, {
    grossSales: 160, discountTotal: 10, netSales: 150, vatTotal: 12,
    netOfVatTotal: 108, unknownVatGross: 30, unattributedAmount: 0,
  })
})
