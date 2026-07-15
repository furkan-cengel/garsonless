import assert from 'node:assert/strict'
import test from 'node:test'
import { ok } from '@garsonless/domain'
import { readOrdersBoard, readPanoTableDetail } from './read-models'

const context = {
  actor: 'dashboard-member' as const,
  userId: 'member',
  restaurantId: 'restaurant-a',
  permissions: ['orders', 'tables'],
}

test('orders board rejects cross-tenant reads before invoking the repository', async () => {
  let invoked = false
  const result = await readOrdersBoard(
    context,
    { restaurantId: 'restaurant-b', since: '2026-07-15T00:00:00Z' },
    { async readBoard() { invoked = true; return ok({ orders: [], tables: [], kitchenToken: null }) } },
  )
  assert.equal(result.ok, false)
  assert.equal(invoked, false)
})

test('orders board forwards a verified tenant read', async () => {
  const result = await readOrdersBoard(
    context,
    { restaurantId: 'restaurant-a', since: '2026-07-15T00:00:00Z' },
    { async readBoard() { return ok({ orders: [{ id: 'order' }], tables: [], kitchenToken: null }) } },
  )
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.value.orders.length, 1)
})

test('pano table detail requires the tables section', async () => {
  const result = await readPanoTableDetail(
    { ...context, permissions: ['pano'] },
    { restaurantId: 'restaurant-a', tableId: 'table' },
    { async readTableDetail() { return ok({ sessionId: 'session', openedAt: '', orders: [] }) } },
  )
  assert.equal(result.ok, false)
})
