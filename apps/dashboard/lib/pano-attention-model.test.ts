import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPanoAttentionItems, getPanoAttentionTableCount, selectVisiblePanoAttentionItems, withPanoConnectionAttention } from './pano-attention-model'
import { formatPanoCurrency, formatPanoDuration, formatPanoInteger } from './pano-format'
import type { TableStatusData } from './queries/insights-shared'

const table = (overrides: Partial<TableStatusData> = {}): TableStatusData => ({
  id: 'table-1', label: 'Masa 1', status: 'late', time: 52, total: 400,
  sessionId: 'session-1', openedAt: '2026-07-29T08:00:00.000Z', unpaidTotal: 400,
  splitSettledTotal: 150, splitDeclaredCashTotal: 0, orderCount: 2, hasUnfinished: false,
  ...overrides,
})

test('Pano numbers share Turkish currency and integer formatting', () => {
  assert.equal(formatPanoCurrency(1234.5), '₺1.234,5')
  assert.equal(formatPanoCurrency(Number.NaN), '₺0')
  assert.equal(formatPanoInteger(1415), '1.415')
  assert.equal(formatPanoDuration(52), '52 dk')
  assert.equal(formatPanoDuration(1_415), '23 sa 35 dk')
  assert.equal(formatPanoDuration(14_714), '10 gün 5 sa')
})

test('stale restaurant-day sessions are separated and cannot hide current signals', () => {
  const staleTables = Array.from({ length: 8 }, (_, index) => table({
    id: `stale-${index}`,
    label: `Eski Masa ${index}`,
    status: 'stale',
    time: 14_714 + index,
    isStaleSession: true,
  }))
  const items = buildPanoAttentionItems({
    restaurantId: 'restaurant-1', generatedAt: '2026-08-21T10:00:00.000Z',
    pendingOrderCount: 1,
    recentOrders: [{ id: 'order-1', status: 'pending', total: 80, tableId: null, tableLabel: null, createdAt: '2026-08-21T09:59:00.000Z' }],
    tableStatuses: staleTables,
    serviceRequests: [{ id: 'service-1', tableId: 'stale-0', requestType: 'water', createdAt: '2026-08-21T09:58:00.000Z' }],
    paymentStatus: null,
  })
  const visible = selectVisiblePanoAttentionItems(items)
  assert.ok(visible.some((item) => item.kind === 'pending_order'))
  assert.ok(visible.some((item) => item.kind === 'service_request'))
  assert.match(items.find((item) => item.kind === 'stale_table')?.detail ?? '', /10 gün 5 sa/)
})

test('attention queue prioritizes pending orders and late tables before service and payment setup', () => {
  const result = buildPanoAttentionItems({
    restaurantId: 'restaurant-1',
    generatedAt: '2026-07-29T09:00:00.000Z',
    pendingOrderCount: 1,
    recentOrders: [{
      id: 'order-1', status: 'pending_approval', total: 320, tableId: 'table-1',
      tableLabel: 'Masa 1', createdAt: '2026-07-29T08:50:00.000Z',
    }],
    tableStatuses: [table()],
    serviceRequests: [{ id: 'request-1', tableId: 'table-1', createdAt: '2026-07-29T08:55:00.000Z', requestType: 'bill' }],
    paymentStatus: { configured: false, mode: null },
  })

  assert.deepEqual(result.map((item) => item.kind), [
    'late_table', 'pending_order', 'service_request', 'payment_configuration',
  ])
  assert.equal(result[0]?.detail, '52 dk · ₺250 açık')
  assert.equal(result[1]?.title, '1 sipariş onay bekliyor')
  assert.equal(result[2]?.title, 'Hesap isteği')
})

test('exact pending aggregate creates an attention signal even outside the recent feed window', () => {
  const result = buildPanoAttentionItems({
    restaurantId: 'restaurant-1',
    generatedAt: '2026-07-29T09:00:00.000Z',
    pendingOrderCount: 4,
    recentOrders: [],
    tableStatuses: [],
    serviceRequests: [],
    paymentStatus: null,
  })
  assert.equal(result[0]?.title, '4 sipariş onay bekliyor')
  assert.match(result[0]?.detail ?? '', /işlem sırasına/)
})

test('connection failure is explicit and attention table count is unique', () => {
  const connected = withPanoConnectionAttention([], 'live', '2026-07-29T09:00:00.000Z')
  assert.deepEqual(connected, [])
  const disconnected = withPanoConnectionAttention([], 'offline', '2026-07-29T09:00:00.000Z')
  assert.equal(disconnected[0]?.kind, 'connection')
  assert.equal(withPanoConnectionAttention([], 'stale', '2026-07-29T09:00:00.000Z')[0]?.severity, 'warning')

  assert.equal(getPanoAttentionTableCount(
    [table(), table({ id: 'table-2', status: 'active' })],
    [
      { id: 'request-1', tableId: 'table-1', createdAt: '', requestType: 'bill' },
      { id: 'request-2', tableId: 'table-2', createdAt: '', requestType: 'water' },
    ],
  ), 2)
})
