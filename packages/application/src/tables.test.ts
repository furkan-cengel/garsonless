import assert from 'node:assert/strict'
import test from 'node:test'
import type { TableServiceRequestPort, TableSessionPort } from './tables'
import {
  closeTableSession,
  requestTableService,
  resolveTableServiceRequest,
} from './tables'

const tableContext = {
  actor: 'dashboard-member' as const,
  restaurantId: 'restaurant-a',
  userId: 'staff',
  permissions: ['tables'],
}

test('table session close rejects cross-tenant replay before calling the port', async () => {
  let touched = false
  const port: TableSessionPort = {
    async closeSession() { touched = true; return { ok: true, value: 'closed_normal' } },
    async listOpenSessions() { return { ok: true, value: [] } },
  }
  const result = await closeTableSession(
    tableContext,
    { sessionId: 'session', restaurantId: 'restaurant-b' },
    port,
  )
  assert.deepEqual(result, { ok: false, error: 'Not authorized' })
  assert.equal(touched, false)
})

test('public service request binds restaurant, internal table and opaque token', async () => {
  let touched = false
  const port: TableServiceRequestPort = {
    async createRequest() { touched = true; return { ok: true, value: { throttled: false } } },
    async resolveRequest() { return { ok: true, value: null } },
    async listPendingRequests() { return { ok: true, value: [] } },
  }
  const result = await requestTableService(
    { actor: 'table-guest', restaurantId: 'restaurant-a', tableId: 'table-a', tableToken: 'token-a' },
    { restaurantId: 'restaurant-a', tableId: 'table-b', tableToken: 'token-a', requestType: 'water' },
    port,
  )
  assert.deepEqual(result, { ok: false, error: 'Invalid table context' })
  assert.equal(touched, false)
})

test('service request resolution requires tables permission', async () => {
  let touched = false
  const port: TableServiceRequestPort = {
    async createRequest() { return { ok: true, value: { throttled: false } } },
    async resolveRequest() { touched = true; return { ok: true, value: null } },
    async listPendingRequests() { return { ok: true, value: [] } },
  }
  const result = await resolveTableServiceRequest(
    { ...tableContext, permissions: ['orders'] },
    { requestId: 'request', restaurantId: 'restaurant-a' },
    port,
  )
  assert.deepEqual(result, { ok: false, error: 'Not authorized' })
  assert.equal(touched, false)
})
