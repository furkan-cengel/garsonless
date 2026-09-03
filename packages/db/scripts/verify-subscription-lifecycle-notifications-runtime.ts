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
assert.equal(new URL(url).host, 'yxsegwkzyiscrxiwdeuf.supabase.co', 'Runtime verification must target DEV')

const options = { auth: { autoRefreshToken: false, persistSession: false } } as const
const admin = createClient<Database>(url, serviceRoleKey, options)
const migrationAdmin = createClient(url, serviceRoleKey, options)
type Rpc = (name: string, args: Record<string, unknown>) => Promise<{
  data: unknown
  error: { message: string } | null
}>
const rpc = admin.rpc.bind(admin) as unknown as Rpc
const marker = `lifecycle-notifications-${Date.now()}-${randomUUID().slice(0, 8)}`
let restaurantId: string | null = null

function iso(epochMs: number): string {
  return new Date(epochMs).toISOString()
}

function resultObject(value: unknown): Record<string, unknown> {
  assert(value && typeof value === 'object' && !Array.isArray(value))
  return value as Record<string, unknown>
}

async function cleanupRestaurant(id: string) {
  const outbox = await admin.from('domain_outbox').select('id').eq('restaurant_id', id)
  assert.ifError(outbox.error)
  const outboxIds = outbox.data?.map((row) => row.id) ?? []
  if (outboxIds.length) {
    assert.ifError((await admin.from('domain_outbox_receipts').delete().in('outbox_id', outboxIds)).error)
  }
  for (const table of [
    'notification_deliveries', 'notification_inbox', 'notification_preferences',
    'domain_outbox', 'restaurant_onboarding_operations', 'restaurant_onboarding_states',
    'accounting_invoice_jobs', 'accounting_review_jobs', 'tenant_lifecycle_events',
    'subscription_payment_attempts', 'subscription_invoices',
    'billing_subscriptions', 'billing_customers',
  ]) {
    assert.ifError((await migrationAdmin.from(table).delete().eq('restaurant_id', id)).error)
  }
  assert.ifError((await admin.from('restaurants').delete().eq('id', id)).error)
}

async function cleanup() {
  const fixtures = await admin.from('restaurants').select('id').like('slug', 'lifecycle-notifications-%')
  assert.ifError(fixtures.error)
  for (const fixture of fixtures.data ?? []) await cleanupRestaurant(fixture.id)
}

async function schedule(occurredAt: string) {
  const { data, error } = await rpc('enqueue_subscription_lifecycle_notifications', {
    p_limit: 100,
    p_occurred_at: occurredAt,
    p_restaurant_id: restaurantId,
  })
  assert.ifError(error)
  return resultObject(data)
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

  const base = Date.now() + 60_000
  const trialEnd = base + 8 * 86_400_000
  const subscription = await migrationAdmin.from('billing_subscriptions').insert({
    restaurant_id: restaurantId,
    billing_customer_id: null,
    provider: null,
    plan: 'pro',
    intended_plan: 'plus',
    billing_interval: 'monthly',
    status: 'trial',
    current_period_start: iso(base),
    current_period_end: iso(trialEnd),
    trial_ends_at: iso(trialEnd),
  }).select('id').single()
  assert.ifError(subscription.error)
  const subscriptionId = subscription.data!.id as string

  const onboarding = await migrationAdmin.from('restaurant_onboarding_states').insert({
    restaurant_id: restaurantId,
    owner_user_id: owner.data!.owner_id,
    status: 'in_progress',
    current_step: 'branding',
    completed_steps: ['business'],
    target_plan: 'plus',
    started_at: iso(base),
    revision: 1,
    updated_at: iso(base),
  })
  assert.ifError(onboarding.error)

  const seven = await schedule(iso(base + 86_400_000))
  assert.equal(seven.trialReminders, 1)
  assert.equal((await schedule(iso(base + 86_400_000))).trialReminders, 0)
  assert.equal(seven.onboardingReminders, 1)
  assert.equal((await schedule(iso(base + 3 * 86_400_000 + 1_000))).onboardingReminders, 1)
  assert.equal((await schedule(iso(base + 3 * 86_400_000 + 1_000))).onboardingReminders, 0)
  console.log('A ✅ onboarding 24h/72h occurrences replay without duplicate outbox rows')

  const three = await schedule(iso(base + 5 * 86_400_000))
  assert.equal(three.trialReminders, 1)
  const one = await schedule(iso(base + 7 * 86_400_000))
  assert.equal(one.trialReminders, 1)
  console.log('B ✅ trial D-7/D-3/D-1 events are idempotent and milestone-specific')

  const expired = await schedule(iso(trialEnd + 1_000))
  assert.equal(expired.expiredTrials, 1)
  const replay = await schedule(iso(trialEnd + 1_000))
  assert.deepEqual(replay, { trialReminders: 0, onboardingReminders: 0, expiredTrials: 0 })
  const state = await admin.from('billing_subscriptions').select('status').eq('id', subscriptionId).single()
  assert.ifError(state.error)
  assert.equal(state.data!.status, 'trial_expired')
  const restaurantState = await admin.from('restaurants').select('plan').eq('id', restaurantId).single()
  assert.ifError(restaurantState.error)
  assert.equal(restaurantState.data!.plan, 'starter')
  console.log('C ✅ due trial expires once, projects the canonical baseline and never creates payment evidence')

  const events = await admin.from('domain_outbox')
    .select('id,event_type,idempotency_key,payload')
    .eq('restaurant_id', restaurantId)
    .in('event_type', [
      'subscription.trial_started', 'subscription.trial_expiring_7',
      'subscription.trial_expiring_3', 'subscription.trial_expiring_1',
      'subscription.trial_expired', 'onboarding.incomplete',
    ])
  assert.ifError(events.error)
  const counts = new Map<string, number>()
  for (const event of events.data ?? []) counts.set(event.event_type, (counts.get(event.event_type) ?? 0) + 1)
  for (const eventType of [
    'subscription.trial_started', 'subscription.trial_expiring_7',
    'subscription.trial_expiring_3', 'subscription.trial_expiring_1',
    'subscription.trial_expired',
  ]) assert.equal(counts.get(eventType), 1)
  assert.equal(counts.get('onboarding.incomplete'), 2)
  assert.equal((await admin.from('subscription_invoices').select('id', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId)).count, 0)
  assert.equal((await admin.from('subscription_payment_attempts').select('id', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId)).count, 0)
  console.log('D ✅ event matrix is exact; invoice and payment ledgers remain untouched')

  const trialEvent = events.data?.find((event) => event.event_type === 'subscription.trial_expiring_7')
  const onboardingEvent = events.data?.find((event) => event.event_type === 'onboarding.incomplete'
    && (event.payload as Record<string, unknown>)['reminderHour'] === 24)
  assert(trialEvent && onboardingEvent)
  const inboxPort = createDashboardInboxPort()
  const trialInbox = await consumeDashboardInbox(trialEvent.id, inboxPort)
  const trialInboxReplay = await consumeDashboardInbox(trialEvent.id, inboxPort)
  const onboardingInbox = await consumeDashboardInbox(onboardingEvent.id, inboxPort)
  assert(trialInbox.ok && onboardingInbox.ok && trialInboxReplay.ok)
  assert.equal(trialInbox.value.delivered, 1)
  assert.equal(onboardingInbox.value.delivered, 1)
  assert.equal(trialInboxReplay.value.duplicate, true)

  const sends: string[] = []
  const providerMessageIds: string[] = []
  const emailPort = createNotificationEmailPort()
  const emailProvider = {
    send: async (input: { to: string }) => {
      sends.push(input.to)
      const messageId = `mock-${randomUUID()}`
      providerMessageIds.push(messageId)
      return { outcome: 'sent' as const, messageId }
    },
  }
  const trialEmail = await consumeNotificationEmail(trialEvent.id, emailPort, emailProvider)
  const trialEmailReplay = await consumeNotificationEmail(trialEvent.id, emailPort, emailProvider)
  const onboardingEmail = await consumeNotificationEmail(onboardingEvent.id, emailPort, emailProvider)
  assert(trialEmail.ok && onboardingEmail.ok && trialEmailReplay.ok)
  assert.equal(trialEmail.value.sent, 1)
  assert.equal(trialEmailReplay.value.duplicate, true)
  assert.equal(onboardingEmail.value.muted, 1)
  assert.equal(sends.length, 1)
  console.log('E ✅ owner inbox/e-mail receipts replay safely; onboarding e-mail remains opt-in')

  const providerEvent = {
    p_webhook_id: `webhook-${randomUUID()}`,
    p_provider_message_id: providerMessageIds[0],
    p_event_type: 'bounced',
    p_occurred_at: iso(base + 86_400_000 + 10_000),
  }
  assert.equal((await rpc('record_resend_notification_event', providerEvent)).data, true)
  assert.equal((await rpc('record_resend_notification_event', providerEvent)).data, true)
  const delivery = await migrationAdmin.from('notification_deliveries')
    .select('provider_delivery_status,last_error')
    .eq('provider_message_id', providerMessageIds[0]).single()
  assert.ifError(delivery.error)
  assert.equal(delivery.data!.provider_delivery_status, 'bounced')
  assert.equal(delivery.data!.last_error, 'provider_bounced')
  const providerEvents = await migrationAdmin.from('notification_delivery_provider_events')
    .select('webhook_id', { count: 'exact', head: true })
    .eq('provider_message_id', providerMessageIds[0])
  assert.ifError(providerEvents.error)
  assert.equal(providerEvents.count, 1)
  const health = await rpc('get_notification_delivery_health', {})
  assert.ifError(health.error)
  const emailHealth = (health.data as Array<Record<string, unknown>>)
    .find((row) => row.consumer === 'notification-email')
  assert(emailHealth && Number(emailHealth.failed_count) >= 1)
  console.log('F ✅ signed-provider projection is replay-safe; bounce is visible in delivery health')

  const invoice = await admin.from('subscription_invoices').insert({
    restaurant_id: restaurantId,
    subscription_id: subscriptionId,
    provider: 'iyzico',
    provider_invoice_ref: `${marker}:fiscal-order`,
    idempotency_key: `${marker}:fiscal-invoice`,
    plan: 'pro',
    billing_interval: 'monthly',
    amount_due_minor: 1_000,
    amount_paid_minor: 1_000,
    currency: 'TRY',
    status: 'paid',
    period_start: iso(base),
    period_end: iso(base + 30 * 86_400_000),
    due_at: iso(base),
    finalized_at: iso(base),
    paid_at: iso(base),
  }).select('id').single()
  assert.ifError(invoice.error)
  const job = await migrationAdmin.from('accounting_invoice_jobs')
    .select('id').eq('subscription_invoice_id', invoice.data!.id).single()
  assert.ifError(job.error)
  const workerId = `fiscal-${randomUUID()}`
  const claimedJob = await migrationAdmin.from('accounting_invoice_jobs').update({
    status: 'processing', attempts: 1, locked_by: workerId, locked_at: iso(base),
    billing_profile_snapshot: {
      legalName: marker, name: 'Test', surname: 'Owner', identityNumber: '11111111111',
      taxOffice: 'Kadıköy', email: `${marker}@example.invalid`,
      billingAddress: { city: 'İstanbul', country: 'Türkiye', address: 'Test adresi' },
      periodStart: iso(base), periodEnd: iso(base + 30 * 86_400_000),
      plan: 'pro', billingInterval: 'monthly',
    },
  }).eq('id', job.data!.id)
  assert.ifError(claimedJob.error)
  const fiscalMessageId = `fiscal-${randomUUID()}`
  const recordedFiscalEmail = await rpc('record_accounting_invoice_email_delivery', {
    p_job_id: job.data!.id,
    p_provider_message_id: fiscalMessageId,
  })
  assert.ifError(recordedFiscalEmail.error)
  assert.equal(recordedFiscalEmail.data, true)
  const completedFiscal = await rpc('complete_accounting_invoice_job', {
    p_job_id: job.data!.id,
    p_worker_id: workerId,
    p_provider_contact_ref: `${marker}:contact`,
    p_provider_invoice_ref: `${marker}:parasut-invoice`,
    p_fiscal_document_type: 'e_arsiv',
  })
  assert.ifError(completedFiscal.error)
  assert.equal(completedFiscal.data, true)
  const fiscalEvent = await admin.from('domain_outbox').select('id')
    .eq('restaurant_id', restaurantId)
    .eq('event_type', 'fiscal_document.ready')
    .eq('aggregate_id', invoice.data!.id).single()
  assert.ifError(fiscalEvent.error)
  const sendCountBeforeFiscalFanout = sends.length
  const fiscalEmail = await consumeNotificationEmail(fiscalEvent.data!.id, emailPort, emailProvider)
  const fiscalInbox = await consumeDashboardInbox(fiscalEvent.data!.id, inboxPort)
  assert(fiscalEmail.ok && fiscalInbox.ok)
  assert.equal(fiscalEmail.value.sent, 1)
  assert.equal(sends.length, sendCountBeforeFiscalFanout)
  assert.equal(fiscalInbox.value.delivered, 1)
  console.log('G ✅ fiscal attachment receipt precedes ready event; fan-out sends no duplicate e-mail')
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
    console.log('H ✅ lifecycle notification runtime fixtures removed')
  }
}

void run().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
