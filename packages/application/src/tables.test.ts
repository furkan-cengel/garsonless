import assert from 'node:assert/strict'
import test from 'node:test'
import type {
  DashboardTablePort,
  KitchenBoardPort,
  KitchenOrderProjection,
  TableServiceRequestPort,
  TableSessionPort,
} from './tables'
import {
  closeTableSession,
  createDashboardTable,
  mergeKitchenOrderProjection,
  readKitchenOrders,
  readDashboardTableLayout,
  renameDashboardTable,
  rotateDashboardTableQrToken,
  requestTableService,
  resolveTableServiceRequest,
  saveDashboardQrStyle,
  saveDashboardTableLayout,
} from './tables'

const tableContext = {
  actor: 'dashboard-member' as const,
  restaurantId: 'restaurant-a',
  userId: 'staff',
  permissions: ['tables'],
}

function dashboardTablePort(overrides: Partial<DashboardTablePort> = {}): DashboardTablePort {
  return {
    async createTable() { return { ok: true, value: { kind: 'created', id: 'table-a', token: 'token-a' } } },
    async renameTable() { return { ok: true, value: null } },
    async deleteTable() { return { ok: true, value: 'deleted' } },
    async listQrTokens() { return { ok: true, value: {} } },
    async rotateQrToken() { return { ok: true, value: 'token-b' } },
    async readRestaurantSlug() { return { ok: true, value: 'cafe-a' } },
    async patchQrStyle(input) {
      return { ok: true, value: { kind: 'saved', snapshot: { revision: input.expectedRevision + 1, style: input.style } } }
    },
    async readLayout() {
      return { ok: true, value: { revision: 0, initializedAt: null, entries: [] } }
    },
    async saveLayout(input) {
      return {
        ok: true,
        value: {
          kind: 'saved',
          idempotent: false,
          snapshot: { revision: input.expectedRevision + 1, initializedAt: '2026-07-29T00:00:00.000Z', entries: input.entries },
        },
      }
    },
    ...overrides,
  }
}

test('dashboard table create rejects cross-tenant replay before touching persistence', async () => {
  let touched = false
  const result = await createDashboardTable(
    tableContext,
    { restaurantId: 'restaurant-b', label: 'Masa 1' },
    dashboardTablePort({
      async createTable() { touched = true; return { ok: true, value: { kind: 'created', id: 'table', token: 'token' } } },
    }),
  )
  assert.deepEqual(result, { ok: false, error: 'Not authorized' })
  assert.equal(touched, false)
})

test('dashboard table create returns the unlimited atomic writer result', async () => {
  const result = await createDashboardTable(
    tableContext,
    { restaurantId: 'restaurant-a', label: 'Masa 4' },
    dashboardTablePort({
      async createTable() { return { ok: true, value: { kind: 'created', id: 'table-4', token: 'token-4' } } },
    }),
  )
  assert.deepEqual(result, { ok: true, value: { kind: 'created', id: 'table-4', token: 'token-4' } })
})

test('dashboard table create and update preserve normalized operational location intent', async () => {
  let createdLocation: { floorLabel?: string | null; areaLabel?: string | null } = {}
  let updatedLocation: { floorLabel?: string | null; areaLabel?: string | null } = {}
  const port = dashboardTablePort({
    async createTable(input) {
      createdLocation = input
      return { ok: true, value: { kind: 'created', id: 'table-a', token: 'token-a' } }
    },
    async renameTable(input) {
      updatedLocation = input
      return { ok: true, value: null }
    },
  })

  await createDashboardTable(tableContext, {
    restaurantId: 'restaurant-a', label: 'Teras 1', floorLabel: '1. Kat', areaLabel: 'Teras',
  }, port)
  await renameDashboardTable(tableContext, {
    restaurantId: 'restaurant-a', tableId: 'table-a', label: 'Teras 2', floorLabel: '2. Kat', areaLabel: null,
  }, port)

  assert.deepEqual(createdLocation, {
    restaurantId: 'restaurant-a', label: 'Teras 1', floorLabel: '1. Kat', areaLabel: 'Teras',
  })
  assert.deepEqual(updatedLocation, {
    restaurantId: 'restaurant-a', tableId: 'table-a', label: 'Teras 2', floorLabel: '2. Kat', areaLabel: null,
  })
})

test('dashboard table location update rejects cross-tenant writes before persistence', async () => {
  let touched = false
  const result = await renameDashboardTable(tableContext, {
    restaurantId: 'restaurant-b', tableId: 'table-a', label: 'Masa', floorLabel: 'Zemin', areaLabel: 'Salon',
  }, dashboardTablePort({ async renameTable() { touched = true; return { ok: true, value: null } } }))

  assert.deepEqual(result, { ok: false, error: 'Not authorized' })
  assert.equal(touched, false)
})

test('dashboard QR rotation derives audit actor from trusted context', async () => {
  let revokedBy = ''
  let requestId = ''
  const result = await rotateDashboardTableQrToken(
    tableContext,
    { restaurantId: 'restaurant-a', tableId: 'table-a', requestId: 'request-a' },
    dashboardTablePort({
      async rotateQrToken(input) {
        revokedBy = input.revokedBy
        requestId = input.requestId
        return { ok: true, value: 'token-b' }
      },
    }),
  )
  assert.deepEqual(result, { ok: true, value: 'token-b' })
  assert.equal(revokedBy, 'staff')
  assert.equal(requestId, 'request-a')
})

test('QR style command rejects cross-tenant writes before persistence', async () => {
  let patched = false
  const result = await saveDashboardQrStyle(
    tableContext,
    {
      restaurantId: 'restaurant-b',
      style: { fg: '#a13b7a' },
      expectedRevision: 0,
    },
    dashboardTablePort({
      async patchQrStyle() {
        patched = true
        return { ok: true, value: { kind: 'saved', snapshot: { revision: 1, style: null } } }
      },
    }),
  )
  assert.deepEqual(result, { ok: false, error: 'Not authorized' })
  assert.equal(patched, false)
})

test('QR style command forwards the trusted expected revision and preserves conflict snapshots', async () => {
  let expectedRevision = -1
  const result = await saveDashboardQrStyle(
    tableContext,
    {
      restaurantId: 'restaurant-a',
      style: { fg: '#a13b7a' },
      expectedRevision: 7,
    },
    dashboardTablePort({
      async patchQrStyle(input) {
        expectedRevision = input.expectedRevision
        return {
          ok: true,
          value: {
            kind: 'conflict',
            snapshot: { revision: 8, style: { fg: '#2f6f4e' } },
          },
        }
      },
    }),
  )
  assert.equal(expectedRevision, 7)
  assert.deepEqual(result, {
    ok: true,
    value: {
      kind: 'conflict',
      snapshot: { revision: 8, style: { fg: '#2f6f4e' } },
    },
  })
})

test('table layout read and save reject cross-tenant access before persistence', async () => {
  let readTouched = false
  let saveTouched = false
  const port = dashboardTablePort({
    async readLayout() {
      readTouched = true
      return { ok: true, value: null }
    },
    async saveLayout() {
      saveTouched = true
      return {
        ok: true,
        value: { kind: 'saved', idempotent: false, snapshot: { revision: 1, initializedAt: null, entries: [] } },
      }
    },
  })

  const readResult = await readDashboardTableLayout(tableContext, 'restaurant-b', port)
  const saveResult = await saveDashboardTableLayout(tableContext, {
    restaurantId: 'restaurant-b',
    expectedRevision: 0,
    requestId: 'request-a',
    entries: [{ tableId: 'table-a', xBp: 100, yBp: 200, shape: 'rectangle', rotation: 0, seatCount: 4 }],
  }, port)

  assert.deepEqual(readResult, { ok: false, error: 'Not authorized' })
  assert.deepEqual(saveResult, { ok: false, error: 'Not authorized' })
  assert.equal(readTouched, false)
  assert.equal(saveTouched, false)
})

test('table layout save derives actor from trusted context and preserves a conflict snapshot', async () => {
  let receivedActor = ''
  const result = await saveDashboardTableLayout(tableContext, {
    restaurantId: 'restaurant-a',
    expectedRevision: 4,
    requestId: 'request-a',
    entries: [{ tableId: 'table-a', xBp: 1200, yBp: 3400, shape: 'square', rotation: 90, seatCount: 6 }],
  }, dashboardTablePort({
    async saveLayout(input) {
      receivedActor = input.actorId
      return {
        ok: true,
        value: {
          kind: 'conflict',
          idempotent: false,
          snapshot: { revision: 5, initializedAt: null, entries: [] },
        },
      }
    },
  }))

  assert.equal(receivedActor, 'staff')
  assert.deepEqual(result, {
    ok: true,
    value: {
      kind: 'conflict',
      idempotent: false,
      snapshot: { revision: 5, initializedAt: null, entries: [] },
    },
  })
})

test('table session close rejects cross-tenant replay before calling the port', async () => {
  let touched = false
  const port: TableSessionPort = {
    async closeSession() { touched = true; return { ok: true, value: 'closed_normal' } },
    async listOpenSessions() { return { ok: true, value: [] } },
    async moveSession() { throw new Error('unexpected') },
    async transferOrders() { throw new Error('unexpected') },
    async transferOrderItems() { throw new Error('unexpected') },
    async readTransferKind() { throw new Error('unexpected') },
    async undoTransfer() { throw new Error('unexpected') },
    async listTransferHistory() { throw new Error('unexpected') },
  }
  const result = await closeTableSession(
    tableContext,
    { sessionId: 'session', restaurantId: 'restaurant-b' },
    port,
  )
  assert.deepEqual(result, { ok: false, error: 'Not authorized' })
  assert.equal(touched, false)
})

test('table session close exposes payment-pending as a typed fail-closed outcome', async () => {
  const port: TableSessionPort = {
    async closeSession() { return { ok: true, value: 'payment_pending' } },
    async listOpenSessions() { return { ok: true, value: [] } },
    async moveSession() { throw new Error('unexpected') },
    async transferOrders() { throw new Error('unexpected') },
    async transferOrderItems() { throw new Error('unexpected') },
    async readTransferKind() { throw new Error('unexpected') },
    async undoTransfer() { throw new Error('unexpected') },
    async listTransferHistory() { throw new Error('unexpected') },
  }
  const result = await closeTableSession(
    tableContext,
    { sessionId: 'session', restaurantId: 'restaurant-a', abnormalReason: 'walkout' },
    port,
  )
  assert.deepEqual(result, { ok: true, value: 'payment_pending' })
})

test('table move requires tables permission while account transfer requires orders permission', async () => {
  let moved = 0
  const port: TableSessionPort = {
    async closeSession() { throw new Error('unexpected') }, async listOpenSessions() { return { ok: true, value: [] } },
    async moveSession() { moved += 1; return { ok: true, value: { operationId: 'op', idempotent: false } } },
    async transferOrders() { moved += 1; return { ok: true, value: { operationId: 'op', idempotent: false } } },
    async transferOrderItems() { moved += 1; return { ok: true, value: { operationId: 'op', idempotent: false } } },
    async readTransferKind() { throw new Error('unexpected') },
    async undoTransfer() { throw new Error('unexpected') }, async listTransferHistory() { return { ok: true, value: [] } },
  }
  const { moveTableSession, transferTableOrders } = await import('./tables')
  const denied = await transferTableOrders(tableContext, { restaurantId: 'restaurant-a', sourceTableId: 'a', targetTableId: 'b', orderIds: ['o'], requestId: 'r' }, port)
  assert.deepEqual(denied, { ok: false, error: 'Not authorized' })
  const movedTable = await moveTableSession(tableContext, { restaurantId: 'restaurant-a', sourceTableId: 'a', targetTableId: 'b', requestId: 'r' }, port)
  assert.equal(movedTable.ok, true)
  assert.equal(moved, 1)
})

test('item transfer validates selection shape and derives actor from trusted context', async () => {
  let receivedActor = ''
  let receivedSelections: Array<{ orderId: string; lineIndex: number; quantity: number }> = []
  const port: TableSessionPort = {
    async closeSession() { throw new Error('unexpected') },
    async listOpenSessions() { throw new Error('unexpected') },
    async moveSession() { throw new Error('unexpected') },
    async transferOrders() { throw new Error('unexpected') },
    async transferOrderItems(input) {
      receivedActor = input.actorId
      receivedSelections = input.selections
      return { ok: true, value: { operationId: 'op', idempotent: false } }
    },
    async readTransferKind() { throw new Error('unexpected') },
    async undoTransfer() { throw new Error('unexpected') },
    async listTransferHistory() { throw new Error('unexpected') },
  }
  const { transferTableOrderItems } = await import('./tables')
  const duplicate = await transferTableOrderItems(
    { ...tableContext, permissions: ['orders'] },
    { restaurantId: 'restaurant-a', sourceTableId: 'a', targetTableId: 'b', requestId: 'r', selections: [
      { orderId: 'order', lineIndex: 1, quantity: 1 }, { orderId: 'order', lineIndex: 1, quantity: 2 },
    ] },
    port,
  )
  assert.deepEqual(duplicate, { ok: false, error: 'Aynı ürün satırı birden fazla kez seçilemez.' })
  const result = await transferTableOrderItems(
    { ...tableContext, permissions: ['orders'] },
    { restaurantId: 'restaurant-a', sourceTableId: 'a', targetTableId: 'b', requestId: 'r', selections: [
      { orderId: 'order', lineIndex: 1, quantity: 2 },
    ] },
    port,
  )
  assert.equal(result.ok, true)
  assert.equal(receivedActor, 'staff')
  assert.deepEqual(receivedSelections, [{ orderId: 'order', lineIndex: 1, quantity: 2 }])
})

test('undo derives account-transfer permission from persisted operation kind', async () => {
  let undone = false
  const port: TableSessionPort = {
    async closeSession() { throw new Error('unexpected') },
    async listOpenSessions() { throw new Error('unexpected') },
    async moveSession() { throw new Error('unexpected') },
    async transferOrders() { throw new Error('unexpected') },
    async transferOrderItems() { throw new Error('unexpected') },
    async readTransferKind() { return { ok: true, value: 'account_transfer' } },
    async undoTransfer() { undone = true; return { ok: true, value: { operationId: 'op', idempotent: false } } },
    async listTransferHistory() { throw new Error('unexpected') },
  }
  const { undoTableTransfer } = await import('./tables')
  const forgedRequest = {
    restaurantId: 'restaurant-a',
    operationId: 'op',
    requiredPermission: 'tables' as const,
  }

  const denied = await undoTableTransfer(
    tableContext,
    forgedRequest,
    port,
  )
  assert.deepEqual(denied, { ok: false, error: 'Not authorized' })
  assert.equal(undone, false)

  const allowed = await undoTableTransfer(
    { ...tableContext, permissions: ['orders'] },
    { restaurantId: 'restaurant-a', operationId: 'op' },
    port,
  )
  assert.equal(allowed.ok, true)
  assert.equal(undone, true)
})

test('undo derives table-move permission from persisted operation kind', async () => {
  let undone = false
  const port: TableSessionPort = {
    async closeSession() { throw new Error('unexpected') },
    async listOpenSessions() { throw new Error('unexpected') },
    async moveSession() { throw new Error('unexpected') },
    async transferOrders() { throw new Error('unexpected') },
    async transferOrderItems() { throw new Error('unexpected') },
    async readTransferKind() { return { ok: true, value: 'table_move' } },
    async undoTransfer() { undone = true; return { ok: true, value: { operationId: 'op', idempotent: false } } },
    async listTransferHistory() { throw new Error('unexpected') },
  }
  const { undoTableTransfer } = await import('./tables')

  const denied = await undoTableTransfer(
    { ...tableContext, permissions: ['orders'] },
    { restaurantId: 'restaurant-a', operationId: 'op' },
    port,
  )
  assert.deepEqual(denied, { ok: false, error: 'Not authorized' })
  assert.equal(undone, false)

  const allowed = await undoTableTransfer(
    tableContext,
    { restaurantId: 'restaurant-a', operationId: 'op' },
    port,
  )
  assert.equal(allowed.ok, true)
  assert.equal(undone, true)
})

test('undo rejects cross-tenant operation lookup before touching persistence', async () => {
  let read = false
  const port: TableSessionPort = {
    async closeSession() { throw new Error('unexpected') },
    async listOpenSessions() { throw new Error('unexpected') },
    async moveSession() { throw new Error('unexpected') },
    async transferOrders() { throw new Error('unexpected') },
    async transferOrderItems() { throw new Error('unexpected') },
    async readTransferKind() { read = true; return { ok: true, value: 'table_move' } },
    async undoTransfer() { throw new Error('unexpected') },
    async listTransferHistory() { throw new Error('unexpected') },
  }
  const { undoTableTransfer } = await import('./tables')
  const result = await undoTableTransfer(
    tableContext,
    { restaurantId: 'restaurant-b', operationId: 'op' },
    port,
  )
  assert.deepEqual(result, { ok: false, error: 'Not authorized' })
  assert.equal(read, false)
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

const kitchenOrder = (input: Partial<KitchenOrderProjection> = {}): KitchenOrderProjection => ({
  id: 'order-a',
  status: 'preparing',
  table_id: 'table-a',
  items: [],
  customer_tier: null,
  paid_at: null,
  created_at: '2026-07-17T08:00:00.000Z',
  updated_at: '2026-07-17T08:00:00.000Z',
  active: true,
  ...input,
})

test('kitchen projection delta upserts active rows and removes tombstones', () => {
  const current = [kitchenOrder(), kitchenOrder({ id: 'order-b' })]
  const merged = mergeKitchenOrderProjection(current, {
    cursor: '2026-07-17T08:01:00.000Z',
    snapshot: false,
    orders: [
      kitchenOrder({ id: 'order-a', status: 'ready', updated_at: '2026-07-17T08:01:00.000Z' }),
      kitchenOrder({ id: 'order-b', status: 'served', active: false }),
      kitchenOrder({ id: 'order-c' }),
    ],
  })
  assert.deepEqual(merged.map((order) => [order.id, order.status]), [
    ['order-a', 'ready'],
    ['order-c', 'preparing'],
  ])
})

test('kitchen projection snapshot drops stale and inactive rows', () => {
  const merged = mergeKitchenOrderProjection([kitchenOrder({ id: 'stale' })], {
    cursor: '2026-07-17T08:01:00.000Z',
    snapshot: true,
    orders: [kitchenOrder({ id: 'fresh' }), kitchenOrder({ id: 'terminal', active: false })],
  })
  assert.deepEqual(merged.map((order) => order.id), ['fresh'])
})

test('kitchen projection rejects cross-tenant polling before touching the port', async () => {
  let touched = false
  const port: KitchenBoardPort = {
    async readBoard() { throw new Error('not used') },
    async readOrders() {
      touched = true
      return { ok: true, value: { cursor: '', snapshot: false, orders: [] } }
    },
  }
  const result = await readKitchenOrders(
    { actor: 'kitchen', restaurantId: 'restaurant-a', stationId: 'expo' },
    { restaurantId: 'restaurant-b', after: null },
    port,
  )
  assert.deepEqual(result, { ok: false, error: 'Not authorized' })
  assert.equal(touched, false)
})
