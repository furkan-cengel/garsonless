import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeDashboardOrderReadRow, type DashboardOrderStorageRow } from './dashboard-order-read-model'

function row(overrides: Partial<DashboardOrderStorageRow> = {}): DashboardOrderStorageRow {
  return {
    id: 'order', restaurant_id: 'restaurant', table_id: null, table_session_id: null,
    session_id: 'session', customer_id: null,
    status: 'pending', source: 'customer', items: [], total: 100,
    discount_breakdown: null, customer_tier: null, paid_at: null, payment_method: null,
    created_at: '2026-07-30T10:00:00.000Z', sent_to_kitchen_at: null,
    ready_at: null, served_at: null, cancel_reason: null, cancelled_by: null,
    settled_by: null, updated_at: '2026-07-30T10:00:00.000Z',
    ...overrides,
  }
}

test('board read model separates legacy settlement storage from operational status', () => {
  const normalized = normalizeDashboardOrderReadRow(row({
    status: 'paid', paid_at: '2026-07-30T10:01:00.000Z', payment_method: 'iyzico',
  }))
  assert.equal(normalized.status, 'preparing')
  assert.equal(normalized.paid_at, '2026-07-30T10:01:00.000Z')
  assert.equal(normalized.payment_method, 'iyzico')
})

test('board read model preserves canonical statuses and closed source vocabulary', () => {
  const normalized = normalizeDashboardOrderReadRow(row({
    status: 'ready', source: 'staff', customer_id: 'customer', settled_by: 'employee',
  }))
  assert.equal(normalized.status, 'ready')
  assert.equal(normalized.customer_id, 'customer')
  assert.equal(normalized.settled_by, 'employee')
  assert.throws(() => normalizeDashboardOrderReadRow(row({ status: 'invented' })), /Unsupported order status/)
  assert.throws(() => normalizeDashboardOrderReadRow(row({ source: 'provider' })), /Unsupported order source/)
})
