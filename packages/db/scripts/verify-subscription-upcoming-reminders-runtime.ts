import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { consumeDashboardInbox } from '@garsonless/application/notifications'
import { consumeNotificationEmail } from '@garsonless/application/notification-emails'
import { createDashboardInboxPort } from '../src/dashboard-inbox-port'
import { createNotificationEmailPort } from '../src/notification-email-port'
import type { Database } from '../src/types.gen'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
assert(url && serviceRoleKey, 'DEV Supabase runtime environment is required')
assert(url.includes('yxsegwkzyiscrxiwdeuf'), 'Runtime verification must target DEV')

const admin = createClient<Database>(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const migrationAdmin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
type Rpc = (name: string, args: Record<string, unknown>) => Promise<{
  data: unknown
  error: { message: string } | null
}>
const rpc = admin.rpc.bind(admin) as unknown as Rpc
const marker = `upcoming-reminder-${Date.now()}-${randomUUID().slice(0, 8)}`
let restaurantId: string | null = null

async function cleanupFixture(id: string) {
  const outbox = await admin.from('domain_outbox').select('id').eq('restaurant_id', id)
  assert.ifError(outbox.error)
  const outboxIds = outbox.data?.map((row) => row.id) ?? []
  if (outboxIds.length) {
    assert.ifError((await admin.from('domain_outbox_receipts').delete().in('outbox_id', outboxIds)).error)
  }
  assert.ifError((await migrationAdmin.from('billing_subscription_provider_refs')
    .delete().eq('restaurant_id', id)).error)
  for (const table of [
    'notification_deliveries', 'notification_inbox', 'domain_outbox',
    'billing_subscriptions', 'billing_customers',
  ] as const) {
    assert.ifError((await admin.from(table).delete().eq('restaurant_id', id)).error)
  }
  assert.ifError((await admin.from('restaurants').delete().eq('id', id)).error)
}

async function cleanup() {
  const fixtures = await admin.from('restaurants').select('id').like('slug', 'upcoming-reminder-%')
  assert.ifError(fixtures.error)
  for (const fixture of fixtures.data ?? []) await cleanupFixture(fixture.id)
}

async function runScheduler(occurredAt: string) {
  const result = await rpc('enqueue_subscription_upcoming_invoice_reminders', {
    p_limit: 100,
    p_occurred_at: occurredAt,
  })
  assert.ifError(result.error)
  assert.equal(typeof result.data, 'number')
  return result.data as number
}

async function main() {
  await cleanup()
  const owner = await admin.from('restaurants').select('owner_id').eq('slug', 'test-cafe-b').single()
  assert.ifError(owner.error)
  const restaurant = await admin.from('restaurants').insert({
    owner_id: owner.data!.owner_id,
    name: marker,
    slug: marker,
    plan: 'pro',
  }).select('id').single()
  assert.ifError(restaurant.error)
  restaurantId = restaurant.data!.id

  const customer = await admin.from('billing_customers').insert({
    restaurant_id: restaurantId,
    legal_name: marker,
    contact_email: `${marker}@example.invalid`,
    provider_customer_ref: `${marker}:customer`,
  }).select('id').single()
  assert.ifError(customer.error)

  const occurredAt = '2026-09-01T09:00:00.000Z'
  const subscription = await admin.from('billing_subscriptions').insert({
    restaurant_id: restaurantId,
    billing_customer_id: customer.data!.id,
    provider: 'iyzico',
    provider_subscription_ref: `${marker}:subscription`,
    plan: 'pro',
    billing_interval: 'monthly',
    status: 'active',
    current_period_start: '2026-08-04T09:00:00.000Z',
    current_period_end: '2026-09-03T09:00:00.000Z',
  }).select('id').single()
  assert.ifError(subscription.error)

  assert.equal(await runScheduler(occurredAt), 1)
  assert.equal(await runScheduler(occurredAt), 0)
  const reminders = await admin.from('domain_outbox')
    .select('id,event_type,aggregate_id,payload,idempotency_key')
    .eq('restaurant_id', restaurantId)
    .eq('event_type', 'invoice.upcoming')
  assert.ifError(reminders.error)
  assert.equal(reminders.data?.length, 1)
  const reminder = reminders.data?.[0]
  assert(reminder)
  assert.equal(reminder.aggregate_id, subscription.data!.id)
  const payload = reminder.payload as Record<string, unknown>
  assert.equal(payload['reminderDays'], 3)
  assert.equal(payload['semanticVersion'], 1)
  assert.match(reminder.idempotency_key, /^billing:invoice-upcoming:v1:/)
  console.log('A ✅ D-3 window enqueued one invoice.upcoming event; identical replay enqueued zero')

  assert.equal((await admin.from('subscription_invoices').select('id', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId)).count, 0)
  const unchanged = await admin.from('billing_subscriptions')
    .select('status,current_period_start,current_period_end').eq('id', subscription.data!.id).single()
  assert.ifError(unchanged.error)
  assert.equal(unchanged.data?.status, 'active')
  assert.equal(unchanged.data?.current_period_end, '2026-09-03T09:00:00+00:00')
  console.log('B ✅ reminder scheduling created no invoice and changed no subscription/payment state')

  const inboxPort = createDashboardInboxPort()
  const inbox = await consumeDashboardInbox(reminder.id, inboxPort)
  const inboxReplay = await consumeDashboardInbox(reminder.id, inboxPort)
  assert(inbox.ok && inboxReplay.ok)
  assert.equal(inbox.value.delivered, 1)
  assert.equal(inboxReplay.value.duplicate, true)

  const sends: string[] = []
  const emailPort = createNotificationEmailPort()
  const emailProvider = {
    send: async (input: { to: string }) => {
      sends.push(input.to)
      return { outcome: 'sent' as const, messageId: `mock-${randomUUID()}` }
    },
  }
  const email = await consumeNotificationEmail(reminder.id, emailPort, emailProvider)
  const emailReplay = await consumeNotificationEmail(reminder.id, emailPort, emailProvider)
  assert(email.ok && emailReplay.ok)
  assert.equal(email.value.sent, 1)
  assert.equal(emailReplay.value.duplicate, true)
  assert.equal(sends.length, 1)

  const inboxRows = await admin.from('notification_inbox')
    .select('id', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId)
  const deliveryRows = await admin.from('notification_deliveries')
    .select('id', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId)
  assert.ifError(inboxRows.error)
  assert.ifError(deliveryRows.error)
  assert.equal(inboxRows.count, 1)
  assert.equal(deliveryRows.count, 1)
  console.log('C ✅ in-app/e-mail consumers delivered once; identical replay produced no spam')
}

async function run() {
  try {
    await main()
  } finally {
    await cleanup()
    if (restaurantId) {
      assert.equal((await admin.from('restaurants').select('id', { count: 'exact', head: true })
        .eq('id', restaurantId)).count, 0)
    }
    console.log('D ✅ upcoming reminder runtime fixtures removed')
  }
}

void run().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
