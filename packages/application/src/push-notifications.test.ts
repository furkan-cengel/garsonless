import assert from 'node:assert/strict'
import test from 'node:test'
import { ok, type Result } from '@garsonless/domain'
import {
  buildDashboardPushPayload,
  consumeDashboardPush,
  pushRecipientSection,
  shouldDispatchDashboardPush,
  type DashboardPushEvent,
  type DashboardPushPort,
  type DashboardPushProvider,
} from './push-notifications'

const event: DashboardPushEvent = {
  id: '11111111-1111-4111-8111-111111111111',
  aggregateId: '22222222-2222-4222-8222-222222222222',
  type: 'order.created',
  restaurantId: 'restaurant-1',
  featureAllowed: true,
  settings: { notifications: { newOrderPush: true } },
  tableLabel: 'Masa 4',
  payload: { total: 150, source: 'customer' },
}

function port(overrides: Partial<DashboardPushPort> = {}): DashboardPushPort {
  return {
    async loadEvent() { return ok(event) },
    async hasReceipt() { return ok(false) },
    async listSubscriptions() { return ok([]) },
    async readDelivery() { return ok(null) },
    async beginDelivery() { return ok(null) },
    async completeDelivery() { return ok(null) },
    async disableSubscription() { return ok(null) },
    async recordReceipt() { return ok(null) },
    ...overrides,
  }
}

const sentProvider: DashboardPushProvider = {
  async send() { return { outcome: 'sent' } },
}

test('resolved entitlement and explicit channel preferences gate durable push', () => {
  assert.equal(shouldDispatchDashboardPush(event), true)
  assert.equal(shouldDispatchDashboardPush({ ...event, featureAllowed: false }), false)
  assert.equal(shouldDispatchDashboardPush({
    ...event,
    settings: { notifications: { newOrderPush: false } },
  }), false)
  assert.equal(shouldDispatchDashboardPush({
    ...event,
    payload: { ...event.payload, source: 'staff' },
  }), false, 'staff-created orders never alert customer-order channels')
  assert.equal(shouldDispatchDashboardPush({
    ...event,
    type: 'service_request.created',
    settings: {},
  }), false, 'waiter-call push is opt-in for existing tenants')
})

test('recipient sections follow the least-privilege dashboard surface', () => {
  assert.equal(pushRecipientSection('order.created'), 'orders')
  assert.equal(pushRecipientSection('service_request.created'), 'tables')
})

test('payload points at the tenant order board and keeps a stable event tag', () => {
  assert.deepEqual(buildDashboardPushPayload(event), {
    title: 'Yeni sipariş',
    body: 'Masa 4 · ₺150,00',
    icon: '/icon.svg',
    badge: '/icon.svg',
    tag: `order:${event.aggregateId}`,
    data: { eventId: event.id, orderId: event.aggregateId, url: '/dashboard/restaurant-1/orders' },
  })
})

test('consumer receipt makes worker replay a no-op', async () => {
  let sends = 0
  const result = await consumeDashboardPush(event.id, port({
    async hasReceipt() { return ok(true) },
  }), { async send() { sends += 1; return { outcome: 'sent' } } })
  assert.equal(sends, 0)
  assert.deepEqual(result, {
    ok: true,
    value: { duplicate: true, skipped: false, subscriptions: 0, sent: 0, gone: 0 },
  })
})

test('successful and expired endpoints complete before the consumer receipt', async () => {
  const calls: string[] = []
  const subscriptions = [
    { id: 'active', endpoint: 'https://push/active', p256dh: 'a', auth: 'b' },
    { id: 'gone', endpoint: 'https://push/gone', p256dh: 'a', auth: 'b' },
  ]
  const result = await consumeDashboardPush(event.id, port({
    async listSubscriptions() { return ok(subscriptions) },
    async beginDelivery(input) { calls.push(`begin:${input.subscriptionId}`); return ok(null) },
    async completeDelivery(input) { calls.push(`${input.status}:${input.subscriptionId}`); return ok(null) },
    async disableSubscription(input) { calls.push(`disable:${input.subscriptionId}`); return ok(null) },
    async recordReceipt() { calls.push('receipt'); return ok(null) },
  }), {
    async send(input) {
      return input.subscription.id === 'gone'
        ? { outcome: 'gone', error: 'Provider 410' }
        : { outcome: 'sent' }
    },
  })

  assert.deepEqual(result, {
    ok: true,
    value: { duplicate: false, skipped: false, subscriptions: 2, sent: 1, gone: 1 },
  })
  assert.deepEqual(calls, [
    'begin:active', 'sent:active',
    'begin:gone', 'gone:gone', 'disable:gone',
    'receipt',
  ])
})

test('transient provider failure leaves the event without a receipt for retry', async () => {
  let receipts = 0
  const result = await consumeDashboardPush(event.id, port({
    async listSubscriptions() {
      return ok([{ id: 'retry', endpoint: 'https://push/retry', p256dh: 'a', auth: 'b' }])
    },
    async recordReceipt() { receipts += 1; return ok(null) },
  }), {
    async send() { return { outcome: 'failed', error: 'Provider 503' } },
  })
  assert.equal(result.ok, false)
  assert.equal(receipts, 0)
})

test('disabled channel records a no-op receipt without listing endpoints', async () => {
  let listed = 0
  let receipts = 0
  const result = await consumeDashboardPush(event.id, port({
    async loadEvent(): Promise<Result<DashboardPushEvent | null>> {
      return ok({ ...event, settings: { notifications: { newOrderPush: false } } })
    },
    async listSubscriptions() { listed += 1; return ok([]) },
    async recordReceipt() { receipts += 1; return ok(null) },
  }), sentProvider)
  assert.equal(listed, 0)
  assert.equal(receipts, 1)
  assert.deepEqual(result, {
    ok: true,
    value: { duplicate: false, skipped: true, subscriptions: 0, sent: 0, gone: 0 },
  })
})
