import assert from 'node:assert/strict'
import test from 'node:test'
import { COLLECTED_ORDER_SPEC, canTransitionOrderStatus, isCollectedOrder } from './orders'

test('order transition matrix keeps terminal and payment states closed', () => {
  assert.equal(canTransitionOrderStatus('pending_approval', 'sent_to_kitchen'), true)
  assert.equal(canTransitionOrderStatus('ready', 'served'), true)
  assert.equal(canTransitionOrderStatus('served', 'preparing'), false)
  assert.equal(canTransitionOrderStatus('pending', 'cancelled'), false)
})

test('collected revenue excludes comp, cancelled and unpaid orders', () => {
  assert.equal(isCollectedOrder({ status: 'served', paidAt: '2026-07-14T10:00:00Z', paymentMethod: 'cash' }), true)
  assert.equal(isCollectedOrder({ status: 'served', paidAt: '2026-07-14T10:00:00Z', paymentMethod: 'comp' }), false)
  assert.equal(isCollectedOrder({ status: 'cancelled', paidAt: '2026-07-14T10:00:00Z', paymentMethod: 'cash' }), false)
  assert.equal(isCollectedOrder({ status: 'served', paidAt: null, paymentMethod: 'cash' }), false)
})

test('collected revenue specification preserves legacy null payment methods', () => {
  assert.deepEqual(COLLECTED_ORDER_SPEC.excludedStatuses, ['cancelled'])
  assert.deepEqual(COLLECTED_ORDER_SPEC.excludedPaymentMethods, ['comp'])
  assert.equal(COLLECTED_ORDER_SPEC.includeNullPaymentMethod, true)
  assert.equal(isCollectedOrder({ status: 'served', paidAt: '2026-07-14T10:00:00Z', paymentMethod: null }), true)
})
