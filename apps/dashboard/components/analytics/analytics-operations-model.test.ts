import assert from 'node:assert/strict'
import test from 'node:test'
import type { StaffSettlementRow } from '../../lib/queries'
import {
  compactCancellationTrend,
  projectOperationDelta,
  sumStaffMethod,
} from './analytics-operations-model'

function settlementRow(overrides: Partial<StaffSettlementRow>): StaffSettlementRow {
  return {
    settledBy: 'user-1',
    label: 'Personel',
    role: 'member',
    sections: ['orders'],
    cash: 0,
    pos: 0,
    otherCollected: 0,
    compAmount: 0,
    compCount: 0,
    collected: 0,
    settledCount: 0,
    highCash: false,
    ...overrides,
  }
}

test('operation deltas preserve the audit-friendly direction and tone policy', () => {
  assert.deepEqual(projectOperationDelta(12), {
    direction: 'up',
    tone: 'critical',
    text: '12%',
  })
  assert.deepEqual(projectOperationDelta(-4.5), {
    direction: 'down',
    tone: 'positive',
    text: '4,5%',
  })
  assert.deepEqual(projectOperationDelta(null), {
    direction: 'up',
    tone: 'critical',
    text: 'Yeni',
  })
  assert.deepEqual(projectOperationDelta(0, 'puan'), {
    direction: 'flat',
    tone: 'neutral',
    text: '0 puan',
  })
})

test('monthly cancellation trend compaction keeps totals while producing four readable buckets', () => {
  const source = Array.from({ length: 8 }, (_, index) => ({
    date: `gün-${index + 1}`,
    count: index + 1,
  }))

  const compact = compactCancellationTrend(source, 'month')

  assert.deepEqual(compact.map((point) => point.label), ['1. hf', '2. hf', '3. hf', '4. hf'])
  assert.equal(compact.reduce((sum, point) => sum + point.count, 0), 36)
  assert.deepEqual(compact.map((point) => point.count), [3, 7, 11, 15])
})

test('staff method totals exclude the automatic payment provider row', () => {
  const rows = [
    settlementRow({ cash: 120, pos: 80 }),
    settlementRow({ settledBy: 'owner-1', role: 'owner', cash: 30, pos: 70 }),
    settlementRow({ settledBy: null, role: 'system', cash: 900, pos: 900 }),
  ]

  assert.equal(sumStaffMethod(rows, 'cash'), 150)
  assert.equal(sumStaffMethod(rows, 'pos'), 150)
})
