import assert from 'node:assert/strict'
import test from 'node:test'
import { formatOrderElapsedMinutes, isActiveOrder, orderStatusGroup, orderUrgencyBadge, projectOrderUrgency } from './order-status'
import type { Order } from './useOrdersRealtime'

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1', restaurant_id: 'restaurant', table_id: null, table_session_id: null,
    status: 'pending', source: 'customer', items: [], total: 10, customer_tier: null,
    paid_at: null, payment_method: null, created_at: '2026-08-22T10:00:00.000Z',
    ...overrides,
  }
}

const atMinute = (minute: number) => new Date(`2026-08-22T10:${String(minute).padStart(2, '0')}:00.000Z`).getTime()

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

test('new and ready queues share the five minute attention and ten minute late boundary', () => {
  assert.equal(projectOrderUrgency(order(), 20, atMinute(4)).level, 'ok')
  assert.equal(projectOrderUrgency(order(), 20, atMinute(5)).level, 'attention')
  assert.equal(projectOrderUrgency(order(), 20, atMinute(10)).level, 'late')

  const ready = order({ status: 'ready', ready_at: '2026-08-22T10:00:00.000Z' })
  assert.equal(projectOrderUrgency(ready, 20, atMinute(5)).readyWaiting, true)
  assert.equal(projectOrderUrgency(ready, 20, atMinute(10)).level, 'late')
})

test('preparation attention starts at sixty percent of the restaurant threshold', () => {
  const prep = order({ status: 'preparing', sent_to_kitchen_at: '2026-08-22T10:00:00.000Z' })
  assert.equal(projectOrderUrgency(prep, 20, atMinute(11)).level, 'ok')
  assert.equal(projectOrderUrgency(prep, 20, atMinute(12)).level, 'attention')
  assert.equal(projectOrderUrgency(prep, 20, atMinute(20)).level, 'late')
})

test('card badge grades approaching, late and forgotten orders', () => {
  const at = (minutes: number) => new Date('2026-08-22T10:00:00.000Z').getTime() + minutes * 60_000
  assert.equal(orderUrgencyBadge(projectOrderUrgency(order(), 20, at(2))), null)
  assert.deepEqual(orderUrgencyBadge(projectOrderUrgency(order(), 20, at(6))), { tone: 'warning', label: 'Yaklaşıyor · 6 dk' })
  assert.deepEqual(orderUrgencyBadge(projectOrderUrgency(order(), 20, at(12))), { tone: 'critical', label: 'Gecikti · 12 dk' })
  assert.deepEqual(orderUrgencyBadge(projectOrderUrgency(order(), 20, at(200))), { tone: 'muted', label: 'Uzun süredir açık · 3 sa 20 dk' })
  const ready = order({ status: 'ready', ready_at: '2026-08-22T10:00:00.000Z' })
  assert.equal(orderUrgencyBadge(projectOrderUrgency(ready, 20, at(6))), null)
})
