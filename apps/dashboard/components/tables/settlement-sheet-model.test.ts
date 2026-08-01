import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { SettlementOrder, SettlementShare } from '../../lib/actions/settlement'
import {
  deriveSettlementProjection,
  fillSettlementMethods,
  toggleSettlementMethod,
} from './settlement-sheet-model'

const order = (
  id: string,
  total: number,
  paymentMethod: SettlementOrder['paymentMethod'] = null,
  paidAt: string | null = null,
): SettlementOrder => ({
  id,
  total,
  paymentMethod,
  paidAt,
  status: paidAt ? 'completed' : 'ready',
  settledBy: null,
  settledByLabel: null,
  createdAt: '2026-07-28T09:00:00.000Z',
  items: [],
})

const share = (
  id: string,
  amount: number,
  method: SettlementShare['method'],
  status: SettlementShare['status'],
  label: string,
): SettlementShare => ({
  id,
  amount,
  method,
  status,
  label,
  settledAt: status === 'settled' ? '2026-07-28T10:00:00.000Z' : null,
  settledBy: null,
  settledByLabel: null,
  createdAt: '2026-07-28T09:00:00.000Z',
})

test('non-split settlement derives staged remaining, tally and collected amount once', () => {
  const orders = [
    order('cash-paid', 100, 'cash', '2026-07-28T10:00:00.000Z'),
    order('online-paid', 80, 'iyzico', '2026-07-28T10:00:00.000Z'),
    order('open', 40),
  ]

  const projection = deriveSettlementProjection(orders, [], { open: 'comp' })

  assert.equal(projection.isSplitMode, false)
  assert.equal(projection.total, 220)
  assert.equal(projection.remaining, 0)
  assert.equal(projection.assigned, 3)
  assert.equal(projection.allStaged, true)
  assert.deepEqual(projection.tally, { cash: 100, pos: 0, comp: 40 })
  assert.equal(projection.collected, 180)
})

test('split settlement ignores staged methods and derives declared versus settled shares', () => {
  const orders = [order('split-order', 200, 'split')]
  const shares: SettlementShare[] = [
    share('paid', 90, 'iyzico', 'settled', 'Kart'),
    share('cash', 60, 'cash', 'declared', 'Nakit'),
    share('card', 50, 'iyzico', 'declared', 'Kart'),
  ]

  const projection = deriveSettlementProjection(orders, shares, { 'split-order': 'cash' })

  assert.equal(projection.isSplitMode, true)
  assert.equal(projection.allStaged, false)
  assert.equal(projection.splitRemaining, 110)
  assert.equal(projection.declaredCashTotal, 60)
  assert.equal(projection.pendingCardTotal, 50)
  assert.deepEqual(projection.tally, { cash: 0, pos: 0, comp: 0 })
  assert.equal(projection.collected, 90)
})

test('staged method helpers toggle one order and fill only the supplied unpaid set', () => {
  const toggled = toggleSettlementMethod({}, 'one', 'cash')
  assert.deepEqual(toggled, { one: 'cash' })
  assert.deepEqual(toggleSettlementMethod(toggled, 'one', 'cash'), {})

  const filled = fillSettlementMethods({ existing: 'comp' }, [order('one', 10), order('two', 20)], 'pos')
  assert.deepEqual(filled, { existing: 'comp', one: 'pos', two: 'pos' })
})
