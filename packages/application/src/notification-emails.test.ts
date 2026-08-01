import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { ok, err } from '@garsonless/domain'
import {
  buildEmailVars,
  consumeNotificationEmail,
  DEFAULT_EMAIL_TEMPLATES,
  NOTIFICATION_EMAIL_MAX_ATTEMPTS,
  renderEmailTemplate,
  type NotificationEmailEvent,
  type NotificationEmailPort,
  type NotificationEmailProvider,
  type NotificationEmailRecipient,
} from './notification-emails'

const ORDER_EVENT: NotificationEmailEvent = {
  id: 'evt-1',
  type: 'order.created',
  restaurantId: 'rest-1',
  aggregateId: 'order-1',
  restaurantName: 'Test Cafe',
  tableLabel: 'Masa 3',
  payload: { total: 150, source: 'customer' },
}

type DeliveryState = { status: 'pending' | 'sent' | 'failed' | 'dead'; attempts: number }

function makeHarness(options: {
  recipients?: NotificationEmailRecipient[]
  receipt?: boolean
  template?: { subject: string; bodyHtml: string } | null
  deliveries?: Record<string, DeliveryState>
  providerOutcome?: 'sent' | 'failed'
}) {
  const sends: Array<{ to: string; subject: string; html: string }> = []
  const receipts: string[] = []
  const deliveries = new Map<string, DeliveryState>(Object.entries(options.deliveries ?? {}))
  const completed: Array<{ userId: string; status: string; error: string | null }> = []

  const port: NotificationEmailPort = {
    loadEvent: async () => ok(ORDER_EVENT),
    hasReceipt: async () => ok(options.receipt ?? false),
    listRecipients: async () => ok(options.recipients ?? [
      { userId: 'u1', email: 'u1@test.dev', prefs: { email: { order: true } } },
    ]),
    loadTemplate: async () => ok(options.template ?? null),
    readDelivery: async ({ recipientUserId }) => ok(deliveries.get(recipientUserId) ?? null),
    beginDelivery: async (input) => {
      deliveries.set(input.recipientUserId, { status: 'pending', attempts: input.attempts })
      return ok(null)
    },
    completeDelivery: async (input) => {
      const current = deliveries.get(input.recipientUserId)
      deliveries.set(input.recipientUserId, {
        status: input.status,
        attempts: current?.attempts ?? 0,
      })
      completed.push({ userId: input.recipientUserId, status: input.status, error: input.error })
      return ok(null)
    },
    recordReceipt: async (eventId) => { receipts.push(eventId); return ok(null) },
  }

  const provider: NotificationEmailProvider = {
    send: async (input) => {
      sends.push(input)
      return (options.providerOutcome ?? 'sent') === 'sent'
        ? { outcome: 'sent', messageId: 'msg-1' }
        : { outcome: 'failed', error: 'smtp 500' }
    },
  }

  return { port, provider, sends, receipts, deliveries, completed }
}

test('template rendering escapes values and drops unknown keys', () => {
  const rendered = renderEmailTemplate(
    { subject: '{{restaurantName}} · {{missing}}', bodyHtml: '<b>{{tableLabel}}</b>' },
    { restaurantName: 'A <script> & "B"', tableLabel: 'Masa <1>' },
  )
  assert.equal(rendered.subject, 'A &lt;script&gt; &amp; &quot;B&quot; · ')
  assert.equal(rendered.bodyHtml, '<b>Masa &lt;1&gt;</b>')
})

test('order vars include the formatted total', () => {
  const vars = buildEmailVars(ORDER_EVENT)
  assert.equal(vars['restaurantName'], 'Test Cafe')
  assert.match(vars['total']!, /150/)
})

test('opt-in recipient gets exactly one send; default recipients are muted', async () => {
  const { port, provider, sends, receipts } = makeHarness({
    recipients: [
      { userId: 'u1', email: 'u1@test.dev', prefs: { email: { order: true } } },
      { userId: 'u2', email: 'u2@test.dev', prefs: null }, // email defaults OFF for order
      { userId: 'u3', email: null, prefs: { email: { order: true } } }, // no address
    ],
  })
  const result = await consumeNotificationEmail('evt-1', port, provider)
  assert.ok(result.ok)
  assert.deepEqual(result.value, { duplicate: false, recipients: 3, sent: 1, muted: 2, dead: 0 })
  assert.equal(sends.length, 1)
  assert.equal(sends[0]!.to, 'u1@test.dev')
  assert.match(sends[0]!.subject, /Test Cafe/)
  assert.deepEqual(receipts, ['evt-1'])
})

test('provider failure returns err without a receipt; retry later succeeds', async () => {
  const harness = makeHarness({ providerOutcome: 'failed' })
  const first = await consumeNotificationEmail('evt-1', harness.port, harness.provider)
  assert.ok(!first.ok)
  assert.equal(harness.receipts.length, 0)
  assert.equal(harness.deliveries.get('u1')!.status, 'failed')
  assert.equal(harness.deliveries.get('u1')!.attempts, 1)

  // The outbox re-dispatches; this time the provider works.
  const retryHarness = makeHarness({
    deliveries: { u1: { status: 'failed', attempts: 1 } },
  })
  const second = await consumeNotificationEmail('evt-1', retryHarness.port, retryHarness.provider)
  assert.ok(second.ok)
  assert.equal(second.value.sent, 1)
  assert.equal(retryHarness.deliveries.get('u1')!.attempts, 2)
  assert.deepEqual(retryHarness.receipts, ['evt-1'])
})

test('already-sent delivery is not re-sent on redispatch', async () => {
  const { port, provider, sends } = makeHarness({
    deliveries: { u1: { status: 'sent', attempts: 1 } },
  })
  const result = await consumeNotificationEmail('evt-1', port, provider)
  assert.ok(result.ok)
  assert.equal(result.value.sent, 1)
  assert.equal(sends.length, 0)
})

test('retry budget exhaustion dead-letters and lets the event complete', async () => {
  const { port, provider, sends, receipts, completed } = makeHarness({
    deliveries: { u1: { status: 'failed', attempts: NOTIFICATION_EMAIL_MAX_ATTEMPTS } },
  })
  const result = await consumeNotificationEmail('evt-1', port, provider)
  assert.ok(result.ok)
  assert.deepEqual(result.value, { duplicate: false, recipients: 1, sent: 0, muted: 0, dead: 1 })
  assert.equal(sends.length, 0)
  assert.equal(completed[0]!.status, 'dead')
  assert.deepEqual(receipts, ['evt-1'])
})

test('receipt short-circuits as duplicate', async () => {
  const { port, provider, sends } = makeHarness({ receipt: true })
  const result = await consumeNotificationEmail('evt-1', port, provider)
  assert.ok(result.ok)
  assert.equal(result.value.duplicate, true)
  assert.equal(sends.length, 0)
})

test('template override replaces the code default', async () => {
  const { port, provider, sends } = makeHarness({
    template: { subject: 'ÖZEL {{restaurantName}}', bodyHtml: '<p>{{tableLabel}}</p>' },
  })
  const result = await consumeNotificationEmail('evt-1', port, provider)
  assert.ok(result.ok)
  assert.equal(sends[0]!.subject, 'ÖZEL Test Cafe')
})

test('code default templates exist for both operational categories', () => {
  assert.ok(DEFAULT_EMAIL_TEMPLATES.order.subject.includes('{{restaurantName}}'))
  assert.ok(DEFAULT_EMAIL_TEMPLATES.service_request.subject.includes('{{restaurantName}}'))
  assert.ok(DEFAULT_EMAIL_TEMPLATES.billing.subject.includes('{{title}}'))
  assert.ok(DEFAULT_EMAIL_TEMPLATES.system.bodyHtml.includes('{{message}}'))
})

test('mandatory billing email ignores a stored opt-out and renders safe billing copy', async () => {
  const harness = makeHarness({
    recipients: [{ userId: 'owner', email: 'owner@test.dev', prefs: { email: { billing: false } } }],
  })
  harness.port.loadEvent = async () => ok({
    ...ORDER_EVENT,
    type: 'billing.warning_7',
    aggregateId: 'invoice-1',
    tableLabel: null,
    payload: {},
  })
  const result = await consumeNotificationEmail('evt-1', harness.port, harness.provider)
  assert.ok(result.ok)
  assert.equal(result.value.sent, 1)
  assert.match(harness.sends[0]!.subject, /Son ödeme uyarısı/)
  assert.match(harness.sends[0]!.html, /geçici olarak duraklatılacak/)
})

test('port failure surfaces as err', async () => {
  const { port, provider } = makeHarness({})
  port.listRecipients = async () => err('db down')
  const result = await consumeNotificationEmail('evt-1', port, provider)
  assert.ok(!result.ok)
})
