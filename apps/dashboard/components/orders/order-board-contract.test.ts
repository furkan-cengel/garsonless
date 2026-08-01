import assert from 'node:assert/strict'
import test from 'node:test'
import { ORDER_BOARD_COLUMNS } from './order-board-contract'

test('order board columns map drop destinations to canonical lifecycle targets', () => {
  assert.deepEqual(
    Object.fromEntries(ORDER_BOARD_COLUMNS.map((column) => [column.id, column.targetStatus])),
    { new: null, prep: 'sent_to_kitchen', ready: 'ready', done: 'served' },
  )
})

test('order board never exposes legacy payment status as an operational column', () => {
  assert.equal(ORDER_BOARD_COLUMNS.some((column) => column.statuses.includes('paid' as never)), false)
})
