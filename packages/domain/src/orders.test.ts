import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ACTIVE_ORDER_STATUSES,
  OPEN_ORDER_STATUSES,
  COLLECTED_ORDER_SPEC,
  canTransitionOrderStatus,
  evaluateOrderCancellation,
  isOrderLifecycleTarget,
  isCollectedOrder,
  normalizeOperationalOrderStatus,
  isValidOrderRefundAmount,
} from './orders'

test('refund amounts accept exact cents despite binary multiplication residue', () => {
  for (const amount of [0.01, 0.29, 1.1, 19.99, 130.01, 1_000_000]) {
    assert.equal(isValidOrderRefundAmount(amount), true, String(amount))
  }
  for (const amount of [0, -1, NaN, Infinity, 1.001, 19.999, 1_000_000.01]) {
    assert.equal(isValidOrderRefundAmount(amount), false, String(amount))
  }
})

test('active order status vocabulary excludes terminal states', () => {
  assert.equal(ACTIVE_ORDER_STATUSES.includes('cancelled'), false)
  assert.equal(ACTIVE_ORDER_STATUSES.includes('paid'), false)
  assert.equal(ACTIVE_ORDER_STATUSES.includes('served'), true)
})

test('open dashboard orders carry across day rollover but exclude terminal states', () => {
  assert.equal(OPEN_ORDER_STATUSES.includes('pending_approval'), true)
  assert.equal(OPEN_ORDER_STATUSES.includes('paid'), true)
  assert.equal(OPEN_ORDER_STATUSES.includes('ready'), true)
  assert.equal(OPEN_ORDER_STATUSES.includes('served'), false)
  assert.equal(OPEN_ORDER_STATUSES.includes('cancelled'), false)
})

test('order transition matrix keeps terminal and payment states closed', () => {
  assert.equal(canTransitionOrderStatus('pending_approval', 'sent_to_kitchen'), true)
  assert.equal(canTransitionOrderStatus('ready', 'served'), true)
  assert.equal(canTransitionOrderStatus('served', 'preparing'), false)
  assert.equal(canTransitionOrderStatus('pending', 'cancelled'), false)
})

test('operational reads normalize legacy paid without inventing payment state', () => {
  assert.equal(normalizeOperationalOrderStatus('paid'), 'preparing')
  assert.equal(normalizeOperationalOrderStatus('ready'), 'ready')
})

test('generic lifecycle targets exclude entry, payment and cancellation states', () => {
  assert.equal(isOrderLifecycleTarget('sent_to_kitchen'), true)
  assert.equal(isOrderLifecycleTarget('served'), true)
  assert.equal(isOrderLifecycleTarget('pending'), false)
  assert.equal(isOrderLifecycleTarget('paid'), false)
  assert.equal(isOrderLifecycleTarget('cancelled'), false)
})

test('collected revenue keeps paid cancellations but excludes comp and unpaid orders', () => {
  assert.equal(isCollectedOrder({ status: 'served', paidAt: '2026-07-14T10:00:00Z', paymentMethod: 'cash' }), true)
  assert.equal(isCollectedOrder({ status: 'served', paidAt: '2026-07-14T10:00:00Z', paymentMethod: 'comp' }), false)
  assert.equal(isCollectedOrder({ status: 'cancelled', paidAt: '2026-07-14T10:00:00Z', paymentMethod: 'cash' }), true)
  assert.equal(isCollectedOrder({ status: 'served', paidAt: null, paymentMethod: 'cash' }), false)
})

test('collected revenue specification preserves legacy null payment methods', () => {
  assert.deepEqual(COLLECTED_ORDER_SPEC.excludedStatuses, [])
  assert.deepEqual(COLLECTED_ORDER_SPEC.excludedPaymentMethods, ['comp'])
  assert.equal(COLLECTED_ORDER_SPEC.includeNullPaymentMethod, true)
  assert.equal(isCollectedOrder({ status: 'served', paidAt: '2026-07-14T10:00:00Z', paymentMethod: null }), true)
})

test('online and split settlements require their dedicated refund paths', () => {
  assert.deepEqual(
    evaluateOrderCancellation({ status: 'served', paidAt: 'now', paymentMethod: 'iyzico' }),
    { allowed: false, error: 'Bu sipariş online ödendi — doğrulanmış İyzico iade akışını kullanın.' },
  )
  assert.deepEqual(
    evaluateOrderCancellation({ status: 'served', paidAt: 'now', paymentMethod: 'split' }),
    { allowed: false, error: 'Bu sipariş hesap bölüşme ile ödendi — pay iadeleri/iptali ayrı iade akışı gerektirir.' },
  )
})

test('paid cash and pos cancellation requires a meaningful reason', () => {
  assert.deepEqual(
    evaluateOrderCancellation({ status: 'served', paidAt: 'now', paymentMethod: 'cash', reason: ' x ' }),
    { allowed: false, error: 'Ödenmiş siparişin iptali için gerekçe zorunlu (en az 3 karakter).' },
  )
  assert.deepEqual(
    evaluateOrderCancellation({ status: 'served', paidAt: 'now', paymentMethod: 'pos', reason: ' iade ' }),
    { allowed: true, reason: 'iade', alreadyCancelled: false },
  )
})

test('cancellation retry is an idempotent no-op', () => {
  assert.deepEqual(
    evaluateOrderCancellation({ status: 'cancelled', paidAt: null, paymentMethod: null }),
    { allowed: true, reason: null, alreadyCancelled: true },
  )
})
