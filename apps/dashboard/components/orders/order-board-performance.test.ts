import assert from 'node:assert/strict'
import test from 'node:test'
import {
  COLUMN_ORDER_LIMIT_STEP,
  INITIAL_COLUMN_ORDER_LIMIT,
  boundedColumnWindow,
} from './order-board-performance'

test('large columns render a bounded first window instead of mounting every card', () => {
  const orders = Array.from({ length: 2_000 }, (_, index) => `order-${index}`)
  const window = boundedColumnWindow(orders, INITIAL_COLUMN_ORDER_LIMIT)

  assert.equal(window.visible.length, INITIAL_COLUMN_ORDER_LIMIT)
  assert.equal(window.hiddenCount, 2_000 - INITIAL_COLUMN_ORDER_LIMIT)
  assert.equal(window.nextLimit, INITIAL_COLUMN_ORDER_LIMIT + COLUMN_ORDER_LIMIT_STEP)
  assert.deepEqual(window.visible, orders.slice(0, INITIAL_COLUMN_ORDER_LIMIT))
})

test('progressive windows remain bounded and preserve canonical order', () => {
  const orders = Array.from({ length: 73 }, (_, index) => index)
  const first = boundedColumnWindow(orders, Number.NaN)
  const second = boundedColumnWindow(orders, first.nextLimit)

  assert.equal(first.visible.length, INITIAL_COLUMN_ORDER_LIMIT)
  assert.equal(second.visible.length, 73)
  assert.equal(second.hiddenCount, 0)
  assert.deepEqual(second.visible, orders)
})
