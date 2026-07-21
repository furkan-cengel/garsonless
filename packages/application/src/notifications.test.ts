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
  payload: { total: 150 },
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
