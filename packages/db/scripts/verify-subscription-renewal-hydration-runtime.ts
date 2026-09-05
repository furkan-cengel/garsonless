import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/types.gen'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
assert(url && serviceRoleKey, 'DEV Supabase runtime environment is required')
assert(url.includes('yxsegwkzyiscrxiwdeuf'), 'Runtime verification must target DEV')
const options = {
  auth: { autoRefreshToken: false, persistSession: false },
} as const
const admin = createClient<Database>(url, serviceRoleKey, options)
// The new provider_plan_ref column intentionally stays inside this migration
// runtime fixture until the repo's pinned type-generation CLI is upgraded.
const migrationAdmin = createClient(url, serviceRoleKey, options)
type Rpc = (
  name: string,
  args: Record<string, unknown>,
) => Promise<{
  data: unknown
  error: { code?: string; message: string } | null
}>
const rpc = admin.rpc.bind(admin) as unknown as Rpc
const marker = `renewal-hydration-${Date.now()}-${randomUUID().slice(0, 8)}`
let restaurantId: string | null = null

function object(value: unknown): Record<string, unknown> {
  assert(value && typeof value === 'object' && !Array.isArray(value))
  return value as Record<string, unknown>
}

async function cleanupFixture(id: string) {
  const outboxIds =
    (await admin.from('domain_outbox').select('id').eq('restaurant_id', id)).data?.map((row) => row.id) ?? []
  if (outboxIds.length) await admin.from('domain_outbox_receipts').delete().in('outbox_id', outboxIds)
  assert.ifError(
    (await migrationAdmin.from('billing_subscription_provider_refs').delete().eq('restaurant_id', id)).error,
  )
  for (const table of [
    'domain_outbox',
    'tenant_lifecycle_events',
    'dunning_runs',
    'billing_reconciliation_jobs',
    'accounting_review_jobs',
    'accounting_invoice_jobs',
    'restaurant_subscription_add_ons',
    'billing_provider_operations',
    'billing_provider_events',
    'subscription_payment_attempts',
    'subscription_invoices',
    'billing_subscriptions',
    'billing_customers',
  ] as const) {
    const deleted = await admin.from(table).delete().eq('restaurant_id', id)
    assert.ifError(deleted.error)
  }
  assert.ifError((await admin.from('restaurants').delete().eq('id', id)).error)
}

async function cleanup() {
  const fixtures = await admin.from('restaurants').select('id').like('slug', 'renewal-hydration-%')
  assert.ifError(fixtures.error)
  for (const fixture of fixtures.data ?? []) await cleanupFixture(fixture.id)
}

async function ingest(input: {
  eventId: string
  eventType: 'invoice.payment_succeeded' | 'invoice.payment_failed'
  customerRef: string
  subscriptionRef: string
  orderRef: string
  occurredAt: string
}) {
  const result = await rpc('ingest_subscription_billing_provider_event', {
    p_provider_event_id: input.eventId,
    p_event_type: input.eventType,
    p_provider_customer_ref: input.customerRef,
    p_provider_subscription_ref: input.subscriptionRef,
    p_provider_invoice_ref: input.orderRef,
    p_payload_sanitized: {
      iyziEventTime: Date.parse(input.occurredAt),
      customerReferenceCode: input.customerRef,
      subscriptionReferenceCode: input.subscriptionRef,
      orderReferenceCode: input.orderRef,
    },
    p_payload_hash: randomUUID().replaceAll('-', ''),
  })
  assert.ifError(result.error)
  assert.equal(object(result.data).dispatchable, false)
}

async function hydrate(input: {
  worker: string
  customerRef: string
  subscriptionRef: string
  orderRef: string
  planRef: string
  periodStart: string
  periodEnd: string
  status: 'succeeded' | 'failed'
}) {
  const claimed = await rpc('claim_subscription_invoice_hydration', {
    p_worker: input.worker,
    p_limit: 10,
    p_lease_seconds: 60,
  })
  assert.ifError(claimed.error)
  const jobs = claimed.data as Array<Record<string, unknown>>
  assert.equal(jobs.length, 1)
  const result = await rpc('hydrate_subscription_invoice_with_payment_identity', {
    p_job_id: jobs[0]!.jobId,
    p_provider_event_id: jobs[0]!.providerEventId,
    p_worker: input.worker,
    p_provider_customer_ref: input.customerRef,
    p_provider_subscription_ref: input.subscriptionRef,
    p_provider_invoice_ref: input.orderRef,
    p_provider_plan_ref: input.planRef,
    p_plan: 'pro',
    p_add_ons: [],
    p_billing_interval: 'monthly',
    p_amount_minor: 143_880,
    p_currency: 'TRY',
    p_period_start: input.periodStart,
    p_period_end: input.periodEnd,
    p_provider_order_status: input.status,
    p_provider_payment_id: input.status === 'succeeded' ? `${input.orderRef}:payment` : null,
    p_occurred_at: jobs[0]!.occurredAtEpochMs
      ? new Date(Number(jobs[0]!.occurredAtEpochMs)).toISOString()
      : new Date().toISOString(),
  })
  assert.ifError(result.error)
  return object(result.data)
}

async function advanceFixtureDunning(input: {
  runId: string
  worker: string
  step: 'retry' | 'warning_3' | 'warning_7' | 'suspend'
  occurredAt: string
  expected: 'advanced' | 'completed'
}) {
  const due = await admin
    .from('dunning_runs')
    .update({ next_action_at: '1900-01-01T00:00:00.000Z' })
    .eq('id', input.runId)
  assert.ifError(due.error)
  const claimed = await rpc('claim_billing_dunning', {
    p_worker: input.worker,
    p_limit: 1,
    p_lease_seconds: 60,
  })
  assert.ifError(claimed.error)
  const rows = claimed.data as Array<Record<string, unknown>>
  assert.equal(rows.length, 1)
  assert.equal(rows[0]?.run_id, input.runId)
  assert.equal(rows[0]?.step, input.step)
  const advanced = await rpc('advance_billing_dunning', {
    p_run_id: input.runId,
    p_worker: input.worker,
    p_completed_step: input.step,
    p_occurred_at: input.occurredAt,
  })
  assert.ifError(advanced.error)
  assert.equal(advanced.data, input.expected)
}

async function main() {
  await cleanup()
  const owner = await admin.from('restaurants').select('owner_id').eq('slug', 'test-cafe-b').single()
  assert.ifError(owner.error)
  const restaurant = await admin
    .from('restaurants')
    .insert({
      owner_id: owner.data!.owner_id,
      name: marker,
      slug: marker,
      plan: 'pro',
    })
    .select('id')
    .single()
  assert.ifError(restaurant.error)
  restaurantId = restaurant.data!.id
  const customerRef = `${marker}:customer`
  const customer = await admin
    .from('billing_customers')
    .insert({
      restaurant_id: restaurantId,
      legal_name: marker,
      contact_email: `${marker}@example.invalid`,
      provider_customer_ref: customerRef,
    })
    .select('id')
    .single()
  assert.ifError(customer.error)
  const subscriptionRef = `${marker}:subscription`
  const planRef = `${marker}:plan-pro-monthly`
  const initialStart = '2026-07-01T00:00:00.000Z'
  const initialEnd = '2026-08-01T00:00:00.000Z'
  const subscription = await migrationAdmin
    .from('billing_subscriptions')
    .insert({
      restaurant_id: restaurantId,
      billing_customer_id: customer.data!.id,
      provider: 'iyzico',
      provider_subscription_ref: subscriptionRef,
      provider_plan_ref: planRef,
      plan: 'pro',
      billing_interval: 'monthly',
      status: 'active',
      current_period_start: initialStart,
      current_period_end: initialEnd,
    })
    .select('id')
    .single()
  assert.ifError(subscription.error)

  const successOrder = `${marker}:order-success`
  await ingest({
    eventId: `${marker}:event-success`,
    eventType: 'invoice.payment_succeeded',
    customerRef,
    subscriptionRef,
    orderRef: successOrder,
    occurredAt: '2026-08-01T00:01:00.000Z',
  })
  const success = await hydrate({
    worker: `${marker}:worker-success`,
    customerRef,
    subscriptionRef,
    orderRef: successOrder,
    planRef,
    periodStart: initialEnd,
    periodEnd: '2026-09-01T00:00:00.000Z',
    status: 'succeeded',
  })
  assert.equal(success.invoiceStatus, 'paid')
  const paidState = await admin
    .from('billing_subscriptions')
    .select('status,current_period_start,current_period_end')
    .eq('id', subscription.data!.id)
    .single()
  assert.ifError(paidState.error)
  assert.equal(paidState.data?.status, 'active')
  assert.equal(Date.parse(paidState.data!.current_period_start!), Date.parse(initialEnd))
  assert.equal(Date.parse(paidState.data!.current_period_end!), Date.parse('2026-09-01T00:00:00.000Z'))
  console.log('A ✅ missing renewal invoice hydrated and success advanced the paid period')

  const failedOrder = `${marker}:order-failed`
  await ingest({
    eventId: `${marker}:event-failed`,
    eventType: 'invoice.payment_failed',
    customerRef,
    subscriptionRef,
    orderRef: failedOrder,
    occurredAt: '2026-09-01T00:01:00.000Z',
  })
  const failed = await hydrate({
    worker: `${marker}:worker-failed`,
    customerRef,
    subscriptionRef,
    orderRef: failedOrder,
    planRef,
    periodStart: '2026-09-01T00:00:00.000Z',
    periodEnd: '2026-10-01T00:00:00.000Z',
    status: 'failed',
  })
  assert.equal(failed.invoiceStatus, 'past_due')
  const failedState = await admin
    .from('billing_subscriptions')
    .select('status,current_period_start,current_period_end')
    .eq('id', subscription.data!.id)
    .single()
  assert.ifError(failedState.error)
  assert.equal(failedState.data?.status, 'past_due')
  assert.equal(Date.parse(failedState.data!.current_period_start!), Date.parse(initialEnd))
  assert.equal(Date.parse(failedState.data!.current_period_end!), Date.parse('2026-09-01T00:00:00.000Z'))
  assert.equal(
    (await admin.from('dunning_runs').select('id', { count: 'exact', head: true }).eq('restaurant_id', restaurantId))
      .count,
    1,
  )
  console.log('B ✅ failed renewal created one past-due invoice/dunning run without advancing period')

  const dunning = await admin
    .from('dunning_runs')
    .select('id,invoice_id,current_step,status')
    .eq('restaurant_id', restaurantId)
    .single()
  assert.ifError(dunning.error)
  assert.equal(dunning.data?.invoice_id, failed.invoiceId)
  const runId = dunning.data!.id
  await advanceFixtureDunning({
    runId,
    worker: `${marker}:dunning-retry`,
    step: 'retry',
    occurredAt: '2026-09-02T00:01:00.000Z',
    expected: 'advanced',
  })
  await advanceFixtureDunning({
    runId,
    worker: `${marker}:dunning-warning-3`,
    step: 'warning_3',
    occurredAt: '2026-09-04T00:01:00.000Z',
    expected: 'advanced',
  })
  await advanceFixtureDunning({
    runId,
    worker: `${marker}:dunning-warning-7`,
    step: 'warning_7',
    occurredAt: '2026-09-08T00:01:00.000Z',
    expected: 'advanced',
  })
  const grace = await admin
    .from('billing_subscriptions')
    .select('status,grace_ends_at')
    .eq('id', subscription.data!.id)
    .single()
  assert.ifError(grace.error)
  assert.equal(grace.data?.status, 'grace_period')
  assert.equal(Date.parse(grace.data!.grace_ends_at!), Date.parse('2026-09-15T00:01:00.000Z'))
  await advanceFixtureDunning({
    runId,
    worker: `${marker}:dunning-suspend`,
    step: 'suspend',
    occurredAt: '2026-09-15T00:01:00.000Z',
    expected: 'completed',
  })
  const completed = await admin
    .from('dunning_runs')
    .select('status,current_step,next_action_at')
    .eq('id', runId)
    .single()
  assert.ifError(completed.error)
  assert.equal(completed.data?.status, 'completed')
  assert.equal(completed.data?.next_action_at, null)
  const suspendedState = await admin
    .from('billing_subscriptions')
    .select('status')
    .eq('id', subscription.data!.id)
    .single()
  assert.ifError(suspendedState.error)
  assert.equal(suspendedState.data?.status, 'suspended')
  for (const eventType of ['billing.retry_requested', 'billing.warning_3', 'billing.warning_7', 'tenant.suspended']) {
    assert.equal(
      (
        await admin
          .from('domain_outbox')
          .select('id', { count: 'exact', head: true })
          .eq('restaurant_id', restaurantId)
          .eq('event_type', eventType)
      ).count,
      1,
    )
  }
  const lostReplay = await rpc('advance_billing_dunning', {
    p_run_id: runId,
    p_worker: `${marker}:dunning-suspend`,
    p_completed_step: 'suspend',
    p_occurred_at: '2026-09-15T00:01:00.000Z',
  })
  assert.ok(lostReplay.error)
  assert.equal(
    (
      await admin
        .from('domain_outbox')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .eq('event_type', 'tenant.suspended')
    ).count,
    1,
  )
  console.log('C ✅ hydrated renewal failure advanced retry/+3/+7/+14 to suspension exactly once')

  const replay = await rpc('ingest_subscription_billing_provider_event', {
    p_provider_event_id: `${marker}:event-success`,
    p_event_type: 'invoice.payment_succeeded',
    p_provider_customer_ref: customerRef,
    p_provider_subscription_ref: subscriptionRef,
    p_provider_invoice_ref: successOrder,
    p_payload_sanitized: {
      iyziEventTime: Date.parse('2026-08-01T00:01:00.000Z'),
      customerReferenceCode: customerRef,
      subscriptionReferenceCode: subscriptionRef,
      orderReferenceCode: successOrder,
    },
    p_payload_hash: 'replay-hash-conflicts-by-design',
  })
  assert.equal(replay.error?.code, 'P0001')
  assert.equal(
    (
      await admin
        .from('subscription_invoices')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
    ).count,
    2,
  )
  console.log('D ✅ changed webhook replay was rejected and invoice cardinality stayed stable')
}

async function run() {
  try {
    await main()
  } finally {
    await cleanup()
    if (restaurantId)
      assert.equal(
        (await admin.from('restaurants').select('id', { count: 'exact', head: true }).eq('id', restaurantId)).count,
        0,
      )
    console.log('E ✅ renewal runtime fixtures removed')
  }
}

void run().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
