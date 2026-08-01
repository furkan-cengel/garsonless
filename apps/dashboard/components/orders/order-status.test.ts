import assert from 'node:assert/strict'
import test from 'node:test'
import { formatOrderElapsedMinutes, isActiveOrder, orderStatusGroup } from './order-status'

test('board status groups use only normalized operational vocabulary', () => {
  assert.equal(orderStatusGroup('pending'), 'new')
  assert.equal(orderStatusGroup('preparing'), 'prep')
  assert.equal(orderStatusGroup('ready'), 'ready')
  assert.equal(orderStatusGroup('served'), 'done')
  assert.equal(orderStatusGroup('cancelled'), 'done')
})

test('active board view means an order still needs an operational action', () => {
  assert.equal(isActiveOrder({ status: 'pending' }), true)
  assert.equal(isActiveOrder({ status: 'ready' }), true)
  assert.equal(isActiveOrder({ status: 'served' }), false)
  assert.equal(isActiveOrder({ status: 'cancelled' }), false)
})

test('elapsed labels stay scannable for long-running legacy orders', () => {
  assert.equal(formatOrderElapsedMinutes(12), '12 dk')
  assert.equal(formatOrderElapsedMinutes(60), '1 sa')
  assert.equal(formatOrderElapsedMinutes(102), '1 sa 42 dk')
  assert.equal(formatOrderElapsedMinutes(3_398), '2 gün 8 sa')
  assert.equal(formatOrderElapsedMinutes(Number.NaN), '0 dk')
})
