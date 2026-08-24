import assert from 'node:assert/strict'
import test from 'node:test'
import type { Order } from './useOrdersRealtime'
import {
  ORDERS_REALTIME_COPY,
  ORDERS_REALTIME_DEBOUNCE_MS,
  ORDERS_REALTIME_SAFETY_INTERVAL_MS,
  canonicalOrderSnapshot,
  normalizeRealtimeOrder,
  rollbackOrderStatus,
  upsertCanonicalOrder,
} from './order-realtime-model'

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1', restaurant_id: 'restaurant', table_id: null, status: 'pending', source: 'customer',
    items: [], total: 10, customer_tier: null, paid_at: null,
    created_at: '2026-07-30T10:00:00.000Z', updated_at: '2026-07-30T10:00:00.000Z',
    ...overrides,
  }
}

test('realtime boundary normalizes legacy paid and fails closed on unknown vocabulary', () => {
  assert.equal(normalizeRealtimeOrder(order({ status: 'preparing' }) as unknown as Record<string, unknown>)?.status, 'preparing')
  assert.equal(normalizeRealtimeOrder({ ...order(), status: 'paid' })?.status, 'preparing')
  assert.equal(normalizeRealtimeOrder({ ...order(), status: 'invented' }), null)
  assert.equal(normalizeRealtimeOrder({ ...order(), source: 'provider' }), null)
})

test('canonical events de-duplicate and never let an older payload regress the board', () => {
  const newer = order({ status: 'ready', updated_at: '2026-07-30T10:05:00.000Z' })
  const current = [newer]
  assert.equal(upsertCanonicalOrder(current, order({ status: 'preparing' })), current)
  assert.deepEqual(upsertCanonicalOrder(current, order({ status: 'preparing' })), [newer])
  assert.equal(upsertCanonicalOrder([newer], newer).length, 1)
})

test('snapshot is deterministic and keeps only the newest row per order', () => {
  const old = order({ status: 'pending' })
  const fresh = order({ status: 'ready', updated_at: '2026-07-30T10:05:00.000Z' })
  const another = order({ id: 'order-2', created_at: '2026-07-30T11:00:00.000Z' })
  assert.deepEqual(canonicalOrderSnapshot([old, fresh, another]).map((item) => [item.id, item.status]), [
    ['order-2', 'pending'],
    ['order-1', 'ready'],
  ])
})

test('rollback only touches the still-optimistic status', () => {
  const optimistic = order({ status: 'ready' })
  assert.equal(rollbackOrderStatus([optimistic], optimistic.id, 'ready', 'preparing')[0]?.status, 'preparing')
  assert.equal(rollbackOrderStatus([order({ status: 'served' })], optimistic.id, 'ready', 'preparing')[0]?.status, 'served')
})

test('connection copy distinguishes reconciliation and safety cadence is bounded', () => {
  assert.equal(ORDERS_REALTIME_DEBOUNCE_MS, 180)
  assert.equal(ORDERS_REALTIME_SAFETY_INTERVAL_MS, 45_000)
  assert.equal(ORDERS_REALTIME_COPY.reconnecting, 'Siparişler yeniden uzlaştırılıyor…')
  assert.match(ORDERS_REALTIME_COPY.stale, /Veriler güncel olmayabilir/)
})
