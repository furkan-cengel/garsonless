import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { ok, err, type Result } from '@garsonless/domain'
import {
  buildInboxContent,
  consumeDashboardInbox,
  inboxCategoryForEvent,
  inboxRecipientSection,
  type DashboardInboxEntry,
  type DashboardInboxEvent,
  type DashboardInboxPort,
  type DashboardInboxRecipient,
} from './notifications'

const ORDER_EVENT: DashboardInboxEvent = {
  id: 'evt-1',
  type: 'order.created',
  restaurantId: 'rest-1',
  aggregateId: 'order-1',
  tableLabel: 'Masa 3',
  payload: { total: 150, source: 'customer' },
}

function makePort(overrides: Partial<DashboardInboxPort> & {
  recipients?: DashboardInboxRecipient[]
  event?: DashboardInboxEvent | null
  receipt?: boolean
}): { port: DashboardInboxPort; inserted: DashboardInboxEntry[]; receipts: string[] } {
  const inserted: DashboardInboxEntry[] = []
  const receipts: string[] = []
  const port: DashboardInboxPort = {
    loadEvent: async () => ok(overrides.event === undefined ? ORDER_EVENT : overrides.event),
    hasReceipt: async () => ok(overrides.receipt ?? false),
    listRecipients: async () => ok(overrides.recipients ?? [{ userId: 'user-1', prefs: null }]),
    insertEntries: async (entries) => { inserted.push(...entries); return ok(null) },
    recordReceipt: async (eventId) => { receipts.push(eventId); return ok(null) },
    ...overrides,
  }
  return { port, inserted, receipts }
}

test('event → category/section/content mapping', () => {
  assert.equal(inboxCategoryForEvent('order.created'), 'order')
  assert.equal(inboxCategoryForEvent('service_request.created'), 'service_request')
  assert.equal(inboxRecipientSection('order.created'), 'orders')
  assert.equal(inboxRecipientSection('service_request.created'), 'tables')
  const content = buildInboxContent(ORDER_EVENT)
  assert.equal(content.title, 'Yeni sipariş')
  assert.match(content.body, /Masa 3/)
  assert.equal(content.linkPath, '/dashboard/rest-1/orders')
})

test('billing notifications are owner-only, unmutable and link to billing settings', () => {
  const event: DashboardInboxEvent = {
    ...ORDER_EVENT,
    type: 'billing.warning_7',
    aggregateId: 'invoice-1',
    tableLabel: null,
    payload: {},
  }
  assert.equal(inboxCategoryForEvent(event.type), 'billing')
  assert.equal(inboxRecipientSection(event.type), null)
  const content = buildInboxContent(event)
  assert.equal(content.severity, 'critical')
  assert.match(content.title, /Son ödeme/)
  assert.equal(content.linkPath, '/dashboard/rest-1/settings?section=billing')
})

test('happy path writes one entry per recipient with a stable dedupe key', async () => {
  const { port, inserted, receipts } = makePort({
    recipients: [{ userId: 'u1', prefs: null }, { userId: 'u2', prefs: null }],
  })
  const result = await consumeDashboardInbox('evt-1', port)
  assert.ok(result.ok)
  assert.deepEqual(result.value, { duplicate: false, recipients: 2, delivered: 2, muted: 0 })
  assert.equal(inserted.length, 2)
  assert.equal(inserted[0]!.dedupeKey, 'order.created:order-1')
  assert.equal(inserted[0]!.dedupeKey, inserted[1]!.dedupeKey)
  assert.deepEqual(receipts, ['evt-1'])
})

test('existing receipt short-circuits as duplicate without writes', async () => {
  const { port, inserted, receipts } = makePort({ receipt: true })
  const result = await consumeDashboardInbox('evt-1', port)
  assert.ok(result.ok)
  assert.equal(result.value.duplicate, true)
  assert.equal(inserted.length, 0)
  assert.equal(receipts.length, 0)
})

test('staff-created order records a no-op receipt without notifying recipients', async () => {
  let listed = 0
  const { port, inserted, receipts } = makePort({
    event: { ...ORDER_EVENT, payload: { ...ORDER_EVENT.payload, source: 'staff' } },
    listRecipients: async () => { listed += 1; return ok([]) },
  })
  const result = await consumeDashboardInbox('evt-1', port)
  assert.ok(result.ok)
  assert.equal(listed, 0)
  assert.equal(inserted.length, 0)
  assert.deepEqual(receipts, ['evt-1'])
})

test('waiter reminder records a no-op inbox receipt without duplicating the pending item', async () => {
  let listed = 0
  const { port, inserted, receipts } = makePort({
    event: {
      ...ORDER_EVENT,
      type: 'service_request.created',
      aggregateId: 'request-1',
      payload: { requestType: 'waiter', reminder: true },
    },
    listRecipients: async () => { listed += 1; return ok([]) },
  })
  const result = await consumeDashboardInbox('evt-1', port)
  assert.ok(result.ok)
  assert.equal(listed, 0)
  assert.equal(inserted.length, 0)
  assert.deepEqual(receipts, ['evt-1'])
})

test('muted recipient is skipped but receipt still records', async () => {
  const { port, inserted, receipts } = makePort({
    recipients: [
      { userId: 'u1', prefs: { inapp: { order: false } } },
      { userId: 'u2', prefs: null },
    ],
  })
  const result = await consumeDashboardInbox('evt-1', port)
  assert.ok(result.ok)
  assert.deepEqual(result.value, { duplicate: false, recipients: 2, delivered: 1, muted: 1 })
  assert.equal(inserted.length, 1)
  assert.equal(inserted[0]!.recipientUserId, 'u2')
  assert.deepEqual(receipts, ['evt-1'])
})

test('insert failure does not record a receipt (retry-safe)', async () => {
  const { port, receipts } = makePort({
    insertEntries: async (): Promise<Result<null>> => err('db down'),
  })
  const result = await consumeDashboardInbox('evt-1', port)
  assert.ok(!result.ok)
  assert.equal(receipts.length, 0)
})

test('unsupported event fails without a receipt', async () => {
  const { port, receipts } = makePort({ event: null })
  const result = await consumeDashboardInbox('evt-1', port)
  assert.ok(!result.ok)
  assert.equal(receipts.length, 0)
})
