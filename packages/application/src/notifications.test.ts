import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { ok, err, type Result } from '@garsonless/domain'
import {
  buildInboxContent,
  buildBillingNotificationContent,
  consumeDashboardInbox,
  inboxCategoryForEvent,
  inboxRecipientSection,
  notificationDedupeKeyForEvent,
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

test('upcoming renewal is mandatory and dedupes per period rather than forever', () => {
  const first: DashboardInboxEvent = {
    ...ORDER_EVENT,
    type: 'invoice.upcoming',
    aggregateId: 'subscription-1',
    tableLabel: null,
    payload: { periodEnd: '2026-10-01T00:00:00.000Z' },
  }
  const second = { ...first, payload: { periodEnd: '2026-11-01T00:00:00.000Z' } }
  assert.equal(inboxRecipientSection(first.type), null)
  assert.equal(buildInboxContent(first).severity, 'info')
  assert.notEqual(notificationDedupeKeyForEvent(first), notificationDedupeKeyForEvent(second))
  assert.equal(
    notificationDedupeKeyForEvent(first),
    'invoice.upcoming:subscription-1:2026-10-01T00:00:00.000Z',
  )
})

test('payment method update is an owner-only billing notification', () => {
  const event: DashboardInboxEvent = {
    ...ORDER_EVENT,
    type: 'payment_method.updated',
    aggregateId: 'subscription-1',
    tableLabel: null,
    payload: {},
  }
  assert.equal(inboxRecipientSection(event.type), null)
  const content = buildInboxContent(event)
  assert.equal(content.severity, 'info')
  assert.match(content.title, /Ödeme yönteminiz güncellendi/)
})

test('period-end cancellation lifecycle stays owner-only and explains access timing', () => {
  const scheduled: DashboardInboxEvent = {
    ...ORDER_EVENT,
    type: 'subscription.cancellation_scheduled',
    aggregateId: 'cancellation-request-1',
    tableLabel: null,
    payload: { effectiveAt: '2026-10-01T00:00:00.000Z' },
  }
  assert.equal(inboxRecipientSection(scheduled.type), null)
  assert.match(buildInboxContent(scheduled).body, /dönem sonuna kadar açık/)
  assert.equal(buildInboxContent({ ...scheduled, type: 'subscription.cancellation_withdrawn' }).severity, 'info')
  assert.equal(buildInboxContent({ ...scheduled, type: 'subscription.cancelled' }).severity, 'critical')
})

test('subscription refund lifecycle is owner-only and keeps money separate from access', () => {
  for (const eventType of ['refund.requested', 'refund.succeeded', 'refund.failed'] as const) {
    assert.equal(inboxRecipientSection(eventType), null)
    const content = buildBillingNotificationContent(eventType, 'restaurant-1')
    assert.equal(content.linkPath, '/dashboard/restaurant-1/settings?section=billing')
    assert.doesNotMatch(`${content.title} ${content.body}`, /paket.*kapat|özellik.*kapat/i)
  }
})

test('trial lifecycle is mandatory billing communication with one event per milestone', () => {
  for (const eventType of [
    'subscription.trial_started',
    'subscription.trial_expiring_7',
    'subscription.trial_expiring_3',
    'subscription.trial_expiring_1',
    'subscription.trial_expired',
  ] as const) {
    assert.equal(inboxCategoryForEvent(eventType), 'billing')
    assert.equal(inboxRecipientSection(eventType), null)
    assert.match(buildBillingNotificationContent(eventType, 'restaurant-1').linkPath, /section=billing/)
  }
})

test('onboarding reminders are owner-only lifecycle messages and dedupe at 24/72 hours', () => {
  const first: DashboardInboxEvent = {
    ...ORDER_EVENT,
    type: 'onboarding.incomplete',
    aggregateId: 'restaurant-1',
    payload: { reminderHour: 24 },
  }
  const second = { ...first, payload: { reminderHour: 72 } }
  assert.equal(inboxCategoryForEvent(first.type), 'lifecycle')
  assert.equal(inboxRecipientSection(first.type), null)
  assert.equal(buildInboxContent(first).linkPath, '/dashboard/onboarding')
  assert.notEqual(notificationDedupeKeyForEvent(first), notificationDedupeKeyForEvent(second))
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
