import assert from 'node:assert/strict'
import test from 'node:test'
import type { Order } from '../orders/useOrdersRealtime'
import { enqueueOrderAlert, resolveOrderAlert } from './order-alert-policy'

const order = (id: string, status = 'pending_approval', source: 'customer' | 'staff' = 'customer') => ({
  id, status, source, restaurant_id: 'r', table_id: null, items: [], total: 10,
  customer_tier: null, paid_at: null, created_at: '2026-07-27T10:00:00.000Z',
}) as Order

test('three rapid customer orders stay ordered and none is overwritten', () => {
  const queue = ['1', '2', '3'].reduce<Order[]>((current, id) => enqueueOrderAlert(current, order(id)), [])
  assert.deepEqual(queue.map((item) => item.id), ['1', '2', '3'])
})
test('replay and staff-entered orders do not create alerts', () => {
  const first = enqueueOrderAlert([], order('1'))
  assert.equal(enqueueOrderAlert(first, order('1')), first)
  assert.deepEqual(enqueueOrderAlert(first, order('2', 'sent_to_kitchen', 'staff')), first)
})

test('approval removes the order without disturbing the remaining queue', () => {
  const queue = [order('1'), order('2'), order('3')]
  assert.deepEqual(resolveOrderAlert(queue, '2').map((item) => item.id), ['1', '3'])
})
