import assert from 'node:assert/strict'
import test from 'node:test'
import { orderMatchesSearch, orderMatchesSource } from './order-filters'
import type { Order } from './useOrdersRealtime'

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-123', restaurant_id: 'restaurant', table_id: 'table', table_session_id: null,
    status: 'pending', source: 'customer', items: [{ name: 'Menemen', quantity: 1, productNote: 'Az pişmiş' }],
    total: 180, customer_tier: null, paid_at: null, payment_method: null,
    created_at: '2026-07-30T10:00:00.000Z',
    ...overrides,
  }
}

test('source filter keeps QR and staff orders distinct', () => {
  assert.equal(orderMatchesSource(order(), 'customer'), true)
  assert.equal(orderMatchesSource(order(), 'staff'), false)
  assert.equal(orderMatchesSource(order({ source: 'staff' }), 'staff'), true)
  assert.equal(orderMatchesSource(order(), 'all'), true)
})

test('search covers Turkish source labels and immutable product notes', () => {
  assert.equal(orderMatchesSearch(order(), 'Masa 1', 'qr menü'), true)
  assert.equal(orderMatchesSearch(order({ source: 'staff' }), 'Masa 1', 'personel'), true)
  assert.equal(orderMatchesSearch(order(), 'Masa 1', 'az pişmiş'), true)
})
