import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import {
  createBillingMaintenancePort,
  type BillingMaintenanceRpc,
} from '../src/billing-maintenance-port'
import { resolveRestaurantFeatureEntitlement, type FeatureEntitlementRpc } from '../src/feature-entitlement-port'
import {
  createSubscriptionCancellationSchedulePort,
  type SubscriptionCancellationRpc,
} from '../src/subscription-cancellation-port'
import {
  createSubscriptionBillingSettingsReadPort,
  type SubscriptionBillingSettingsRpc,
} from '../src/subscription-billing-settings-port'
import type { Database } from '../src/types.gen'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
assert(url && serviceRoleKey, 'DEV Supabase runtime environment is required')
assert.equal(new URL(url).host, 'yxsegwkzyiscrxiwdeuf.supabase.co', 'Runtime verification must target DEV')
assert.equal(process.env.IYZICO_BILLING_BASE_URL, 'https://sandbox-api.iyzipay.com', 'Runtime verification must use iyzico sandbox config')

const options = { auth: { autoRefreshToken: false, persistSession: false } } as const
const admin = createClient<Database>(url, serviceRoleKey, options)
const migrationAdmin = createClient(url, serviceRoleKey, options)
type Rpc = (name: string, args: Record<string, unknown>) => Promise<{
  data: unknown
  error: { code?: string; message: string } | null
}>
const rpc = admin.rpc.bind(admin) as unknown as Rpc
const cancellations = createSubscriptionCancellationSchedulePort(rpc as SubscriptionCancellationRpc)
const maintenance = createBillingMaintenancePort(rpc as BillingMaintenanceRpc)
const settings = createSubscriptionBillingSettingsReadPort(rpc as SubscriptionBillingSettingsRpc)
const entitlementRpc = rpc as FeatureEntitlementRpc
const marker = `period-end-cancel-${Date.now()}-${randomUUID().slice(0, 8)}`
const restaurantIds: string[] = []

type Fixture = {
  restaurantId: string
  subscriptionId: string
  ownerId: string
  periodStart: string
  periodEnd: string
}

function fingerprint(value: string): string {
  return createHash('sha256').update(`${marker}:${value}`).digest('hex')
}

async function cleanupRestaurant(restaurantId: string) {
  const outbox = await admin.from('domain_outbox').select('id').eq('restaurant_id', restaurantId)
  assert.ifError(outbox.error)
  const outboxIds = outbox.data?.map((row) => row.id) ?? []
  if (outboxIds.length) {
    assert.ifError((await admin.from('domain_outbox_receipts').delete().in('outbox_id', outboxIds)).error)
  }
  for (const table of [
    'notification_deliveries', 'notification_inbox', 'domain_outbox',
    'accounting_review_jobs', 'accounting_invoice_jobs', 'tenant_lifecycle_events',
    'subscription_cancellation_provider_targets',
    'subscription_cancellation_requests', 'billing_reconciliation_jobs',
    'billing_provider_operations', 'billing_subscription_provider_refs',
    'subscription_change_requests', 'restaurant_subscription_add_ons',
    'billing_provider_events', 'subscription_payment_attempts',
    'subscription_invoices', 'billing_subscriptions', 'billing_customers',
  ]) {
    const deleted = await migrationAdmin.from(table).delete().eq('restaurant_id', restaurantId)
    assert.ifError(deleted.error)
  }
  assert.ifError((await admin.from('restaurants').delete().eq('id', restaurantId)).error)
}

async function cleanup() {
  const fixtures = await admin.from('restaurants').select('id').like('slug', 'period-end-cancel-%')
  assert.ifError(fixtures.error)
  for (const fixture of fixtures.data ?? []) await cleanupRestaurant(fixture.id)
}

async function createFixture(input: {
  ownerId: string
  suffix: string
  plan: 'starter' | 'plus'
  periodStart: string
  periodEnd: string
  withVideoAddOn?: boolean
}): Promise<Fixture> {
  const slug = `${marker}-${input.suffix}`
  const restaurant = await admin.from('restaurants').insert({
    owner_id: input.ownerId, name: slug, slug, plan: input.plan,
  }).select('id').single()
  assert.ifError(restaurant.error)
  restaurantIds.push(restaurant.data!.id)
  const customer = await admin.from('billing_customers').insert({
    restaurant_id: restaurant.data!.id,
    legal_name: slug,
    contact_email: `${slug}@example.invalid`,
    provider_customer_ref: `${slug}:customer`,
  }).select('id').single()
  assert.ifError(customer.error)
  const subscription = await migrationAdmin.from('billing_subscriptions').insert({
    restaurant_id: restaurant.data!.id,
    billing_customer_id: customer.data!.id,
    provider: 'iyzico',
    provider_subscription_ref: `${slug}:subscription`,
    provider_plan_ref: `${slug}:provider-plan`,
    plan: input.plan,
    billing_interval: 'monthly',
    status: 'active',
    current_period_start: input.periodStart,
    current_period_end: input.periodEnd,
  }).select('id').single()
  assert.ifError(subscription.error)
  if (input.withVideoAddOn) {
    const addOn = await migrationAdmin.from('restaurant_subscription_add_ons').insert({
      restaurant_id: restaurant.data!.id,
      add_on: 'storefront_video_hero',
      subscription_id: subscription.data!.id,
      status: 'active',
      current_period_start: input.periodStart,
      current_period_end: input.periodEnd,
      activated_at: input.periodStart,
    })
    assert.ifError(addOn.error)
  }
  return {
    restaurantId: restaurant.data!.id,
    subscriptionId: subscription.data!.id,
    ownerId: input.ownerId,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
  }
}

async function schedule(fixture: Fixture, key: string, occurredAt: string) {
  const result = await cancellations.scheduleCancellation({
    restaurantId: fixture.restaurantId,
    idempotencyKey: `${marker}:${key}`,
    requestFingerprint: fingerprint(key),
    requestedBy: fixture.ownerId,
    occurredAt,
  })
  assert.ok(result.ok)
  return result.value
}

async function readSettings(fixture: Fixture) {
  const result = await settings.readSettings({ restaurantId: fixture.restaurantId })
  assert.ok(result.ok)
  assert(result.value.subscription)
  return result.value
}

async function claim(worker: string, occurredAt: string) {
  const result = await maintenance.claimScheduledCancellations({
    workerId: worker,
    limit: 1,
    leaseSeconds: 60,
    occurredAt,
  })
  if (!result.ok) assert.fail(result.error)
  return result.value
}

async function assertProviderClaimWindow(expectedRequestId: string | null, occurredAt: string) {
  const requests = await migrationAdmin.from('subscription_cancellation_requests')
    .select('id')
    .in('status', ['scheduled', 'processing'])
    .lte('provider_cancel_at', occurredAt)
  assert.ifError(requests.error)
  assert.deepEqual((requests.data ?? []).map((row) => row.id).sort(), expectedRequestId ? [expectedRequestId] : [])
  if (expectedRequestId) {
    const targets = await migrationAdmin.from('subscription_cancellation_provider_targets')
      .select('id', { count: 'exact', head: true })
      .eq('cancellation_request_id', expectedRequestId)
      .eq('status', 'scheduled')
      .lte('next_attempt_at', occurredAt)
    assert.ifError(targets.error)
    assert.equal(targets.count, 1)
  }
}

async function applyDueAccess(occurredAt: string, expectedRequestId: string | null = null) {
  const requests = await migrationAdmin.from('subscription_cancellation_requests')
    .select('id')
    .eq('mode', 'period_end')
    .eq('status', 'provider_cancelled')
    .lte('effective_at', occurredAt)
  assert.ifError(requests.error)
  assert.deepEqual((requests.data ?? []).map((row) => row.id).sort(), expectedRequestId ? [expectedRequestId] : [])
  const result = await maintenance.applyDueCancellationAccess({ limit: 10, occurredAt })
  if (!result.ok) assert.fail(result.error)
  return result.value
}

async function main() {
  await cleanup()
  const owner = await admin.from('restaurants').select('owner_id').eq('slug', 'test-cafe-b').single()
  assert.ifError(owner.error)

  const success = await createFixture({
    ownerId: owner.data!.owner_id,
    suffix: 'success',
    plan: 'starter',
    periodStart: '1999-08-01T09:00:00.000Z',
    periodEnd: '1999-09-01T09:00:00.000Z',
    withVideoAddOn: true,
  })
  const scheduled = await schedule(success, 'schedule-1', '1999-08-10T09:00:00.000Z')
  assert.equal(scheduled.status, 'scheduled')
  assert.equal(Date.parse(scheduled.effectiveAt), Date.parse(success.periodEnd))
  const replay = await schedule(success, 'schedule-1', '1999-08-10T09:00:00.000Z')
  assert.equal(replay.duplicate, true)
  assert.equal(replay.cancellationRequestId, scheduled.cancellationRequestId)
  assert.equal((await migrationAdmin.from('subscription_cancellation_requests')
    .select('id', { count: 'exact', head: true }).eq('restaurant_id', success.restaurantId)).count, 1)
  assert.equal((await admin.from('domain_outbox').select('id', { count: 'exact', head: true })
    .eq('restaurant_id', success.restaurantId)
    .eq('event_type', 'subscription.cancellation_scheduled')).count, 1)
  const scheduledSettings = await readSettings(success)
  assert.equal(scheduledSettings.subscription!.status, 'active')
  assert.equal(scheduledSettings.subscription!.cancelAtPeriodEnd, true)
  assert.equal(scheduledSettings.subscription!.cancellationRequestId, scheduled.cancellationRequestId)
  console.log('A ✅ period-end request and replay created one intent/event while paid access stayed active')

  const upcoming = await rpc('enqueue_subscription_upcoming_invoice_reminders', {
    p_limit: 100,
    p_occurred_at: '1999-08-29T09:00:00.000Z',
  })
  assert.ifError(upcoming.error)
  assert.equal(upcoming.data, 0)
  assert.equal((await admin.from('domain_outbox').select('id', { count: 'exact', head: true })
    .eq('restaurant_id', success.restaurantId).eq('event_type', 'invoice.upcoming')).count, 0)
  console.log('B ✅ scheduled cancellation suppressed the D-3 renewal reminder')

  const withdrawn = await cancellations.withdrawCancellation({
    restaurantId: success.restaurantId,
    cancellationRequestId: scheduled.cancellationRequestId,
    idempotencyKey: `${marker}:withdraw-1`,
    requestFingerprint: fingerprint('withdraw-1'),
    withdrawnBy: success.ownerId,
    occurredAt: '1999-08-20T09:00:00.000Z',
  })
  assert.ok(withdrawn.ok)
  const withdrawnReplay = await cancellations.withdrawCancellation({
    restaurantId: success.restaurantId,
    cancellationRequestId: scheduled.cancellationRequestId,
    idempotencyKey: `${marker}:withdraw-1`,
    requestFingerprint: fingerprint('withdraw-1'),
    withdrawnBy: success.ownerId,
    occurredAt: '1999-08-20T09:00:00.000Z',
  })
  assert.ok(withdrawnReplay.ok)
  assert.equal(withdrawnReplay.value.duplicate, true)
  const afterWithdrawal = await readSettings(success)
  assert.equal(afterWithdrawal.subscription!.cancelAtPeriodEnd, false)
  assert.equal(afterWithdrawal.subscription!.cancellationRequestId, null)
  assert.equal((await admin.from('domain_outbox').select('id', { count: 'exact', head: true })
    .eq('restaurant_id', success.restaurantId)
    .eq('event_type', 'subscription.cancellation_withdrawn')).count, 1)
  console.log('C ✅ withdrawal and replay restored renewal intent without duplicate notification')

  const due = await schedule(success, 'schedule-2', '1999-08-21T09:00:00.000Z')
  const worker = `${marker}:success-worker`
  const providerCutoff = '1999-08-31T09:00:00.000Z'
  await assertProviderClaimWindow(null, '1999-08-31T08:59:59.000Z')
  assert.equal((await claim(worker, '1999-08-31T08:59:59.000Z')).length, 0)
  await assertProviderClaimWindow(due.cancellationRequestId, providerCutoff)
  const jobs = await claim(worker, providerCutoff)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0]?.cancellationRequestId, due.cancellationRequestId)
  assert.equal(Date.parse(String(jobs[0]?.providerCancelAt)), Date.parse(providerCutoff))
  assert.equal((await claim(worker, providerCutoff)).length, 0)
  const completed = await maintenance.completeScheduledCancellation({
    job: jobs[0]!,
    workerId: worker,
    providerCancelledAt: '1999-08-31T09:00:01.000Z',
    occurredAt: '1999-08-31T09:00:01.000Z',
  })
  if (!completed.ok) assert.fail(completed.error)
  assert.equal(completed.value.status, 'provider_cancelled')
  assert.equal(completed.value.requestCompleted, false)
  assert.equal(completed.value.duplicate, false)
  const completionReplay = await maintenance.completeScheduledCancellation({
    job: jobs[0]!,
    workerId: worker,
    providerCancelledAt: '1999-08-31T09:00:01.000Z',
    occurredAt: '1999-08-31T09:00:01.000Z',
  })
  if (!completionReplay.ok) assert.fail(completionReplay.error)
  assert.equal(completionReplay.value.duplicate, true)
  assert.equal(completionReplay.value.requestCompleted, false)
  assert.equal((await claim(worker, '1999-08-31T09:00:02.000Z')).length, 0)
  const cutoffRequest = await migrationAdmin.from('subscription_cancellation_requests')
    .select('status,provider_cancel_at,provider_cancelled_at').eq('id', due.cancellationRequestId).single()
  assert.ifError(cutoffRequest.error)
  assert.equal(cutoffRequest.data?.status, 'provider_cancelled')
  assert.equal(Date.parse(String(cutoffRequest.data?.provider_cancel_at)), Date.parse(providerCutoff))
  assert.equal(
    Date.parse(String(cutoffRequest.data?.provider_cancelled_at)),
    Date.parse('1999-08-31T09:00:01.000Z'),
  )
  const stillOpen = await migrationAdmin.from('billing_subscriptions')
    .select('status,cancel_at_period_end').eq('id', success.subscriptionId).single()
  assert.ifError(stillOpen.error)
  assert.equal(stillOpen.data?.status, 'active')
  assert.equal(stillOpen.data?.cancel_at_period_end, true)
  const stillActiveAddOn = await migrationAdmin.from('restaurant_subscription_add_ons')
    .select('status').eq('restaurant_id', success.restaurantId).single()
  assert.ifError(stillActiveAddOn.error)
  assert.equal(stillActiveAddOn.data?.status, 'active')
  const cutoffSettings = await readSettings(success)
  assert.equal(cutoffSettings.subscription!.cancellationStatus, 'provider_cancelled')
  const beforeBoundaryAccess = await resolveRestaurantFeatureEntitlement({
    restaurantId: success.restaurantId, plan: 'starter', feature: 'qr_menu',
    now: new Date('1999-08-31T09:00:02.000Z'),
  }, entitlementRpc)
  assert.ok(beforeBoundaryAccess.ok)
  assert.equal(beforeBoundaryAccess.value.allowed, true)
  assert.deepEqual(await applyDueAccess('1999-09-01T08:59:59.000Z'), { applied: 0, reconciled: 0 })
  assert.deepEqual(await applyDueAccess(success.periodEnd, due.cancellationRequestId), { applied: 1, reconciled: 0 })
  assert.deepEqual(await applyDueAccess('1999-09-01T09:00:01.000Z'), { applied: 0, reconciled: 0 })
  const closed = await migrationAdmin.from('billing_subscriptions')
    .select('status,cancel_at_period_end,cancelled_at').eq('id', success.subscriptionId).single()
  assert.ifError(closed.error)
  assert.equal(closed.data?.status, 'cancelled')
  assert.equal(closed.data?.cancel_at_period_end, false)
  const addOn = await migrationAdmin.from('restaurant_subscription_add_ons')
    .select('status,cancelled_at').eq('restaurant_id', success.restaurantId).single()
  assert.ifError(addOn.error)
  assert.equal(addOn.data?.status, 'cancelled')
  const closedPlan = await admin.from('restaurants').select('plan').eq('id', success.restaurantId).single()
  assert.ifError(closedPlan.error)
  assert.equal(closedPlan.data?.plan, 'starter')
  assert.equal((await admin.from('domain_outbox').select('id', { count: 'exact', head: true })
    .eq('restaurant_id', success.restaurantId).eq('event_type', 'subscription.cancelled')).count, 1)
  assert.equal((await admin.from('tenant_lifecycle_events').select('id', { count: 'exact', head: true })
    .eq('restaurant_id', success.restaurantId).eq('reason_code', 'tenant_cancelled_period_end')).count, 1)
  const denied = await resolveRestaurantFeatureEntitlement({
    restaurantId: success.restaurantId, plan: 'starter', feature: 'qr_menu',
    now: new Date('1999-09-01T09:00:02.000Z'),
  }, entitlementRpc)
  assert.ok(denied.ok)
  assert.equal(denied.value.allowed, false)
  console.log('D ✅ provider cutoff completed before renewal; paid access closed once only at period end')

  const ambiguous = await createFixture({
    ownerId: owner.data!.owner_id,
    suffix: 'ambiguous',
    plan: 'plus',
    periodStart: '2000-01-01T09:00:00.000Z',
    periodEnd: '2000-02-01T09:00:00.000Z',
  })
  const ambiguousRequest = await schedule(ambiguous, 'ambiguous-schedule', '2000-01-10T09:00:00.000Z')
  const ambiguousWorker = `${marker}:ambiguous-worker`
  await assertProviderClaimWindow(ambiguousRequest.cancellationRequestId, '2000-01-31T09:00:00.000Z')
  const ambiguousJobs = await claim(ambiguousWorker, '2000-01-31T09:00:00.000Z')
  assert.equal(ambiguousJobs.length, 1)
  assert.equal(ambiguousJobs[0]?.cancellationRequestId, ambiguousRequest.cancellationRequestId)
  const failed = await maintenance.failScheduledCancellation({
    job: ambiguousJobs[0]!,
    workerId: ambiguousWorker,
    reason: 'runtime simulated ambiguous provider result',
  })
  if (!failed.ok) assert.fail(failed.error)
  assert.equal(failed.value, true)
  const quarantined = await migrationAdmin.from('subscription_cancellation_requests')
    .select('status').eq('id', ambiguousRequest.cancellationRequestId).single()
  assert.ifError(quarantined.error)
  assert.equal(quarantined.data?.status, 'requires_reconciliation')
  const ambiguousSubscription = await migrationAdmin.from('billing_subscriptions')
    .select('status,cancel_at_period_end').eq('id', ambiguous.subscriptionId).single()
  assert.ifError(ambiguousSubscription.error)
  assert.equal(ambiguousSubscription.data?.status, 'active')
  assert.equal(ambiguousSubscription.data?.cancel_at_period_end, true)
  assert.equal((await migrationAdmin.from('billing_reconciliation_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('restaurant_id', ambiguous.restaurantId)
    .eq('dedupe_key', `cancellation-target:${ambiguousJobs[0]!.cancellationTargetId}`)).count, 1)
  assert.deepEqual(await applyDueAccess('2000-02-01T09:00:01.000Z'), { applied: 0, reconciled: 0 })
  const access = await resolveRestaurantFeatureEntitlement({
    restaurantId: ambiguous.restaurantId, plan: 'plus', feature: 'table_management',
    now: new Date('2000-02-01T09:00:01.000Z'),
  }, entitlementRpc)
  assert.ok(access.ok)
  assert.equal(access.value.allowed, true)
  console.log('E ✅ ambiguous provider cutoff entered reconciliation while local subscription access stayed open')

  const renewalRace = await createFixture({
    ownerId: owner.data!.owner_id,
    suffix: 'renewal-race',
    plan: 'plus',
    periodStart: '2001-03-01T09:00:00.000Z',
    periodEnd: '2001-04-01T09:00:00.000Z',
  })
  const raceRequest = await schedule(renewalRace, 'race-schedule', '2001-03-10T09:00:00.000Z')
  const raceWorker = `${marker}:race-worker`
  await assertProviderClaimWindow(raceRequest.cancellationRequestId, '2001-03-31T09:00:00.000Z')
  const raceJobs = await claim(raceWorker, '2001-03-31T09:00:00.000Z')
  assert.equal(raceJobs.length, 1)
  assert.equal(raceJobs[0]?.cancellationRequestId, raceRequest.cancellationRequestId)
  const raceCutoff = await maintenance.completeScheduledCancellation({
    job: raceJobs[0]!,
    workerId: raceWorker,
    providerCancelledAt: '2001-03-31T09:00:01.000Z',
    occurredAt: '2001-03-31T09:00:01.000Z',
  })
  if (!raceCutoff.ok) assert.fail(raceCutoff.error)
  assert.equal(raceCutoff.value.status, 'provider_cancelled')
  const renewed = await migrationAdmin.from('billing_subscriptions').update({
    current_period_start: '2001-04-01T09:00:00.000Z',
    current_period_end: '2001-05-01T09:00:00.000Z',
  }).eq('id', renewalRace.subscriptionId)
  assert.ifError(renewed.error)
  assert.deepEqual(
    await applyDueAccess(renewalRace.periodEnd, raceRequest.cancellationRequestId),
    { applied: 0, reconciled: 1 },
  )
  assert.deepEqual(await applyDueAccess('2001-04-01T09:00:01.000Z'), { applied: 0, reconciled: 0 })
  const raceState = await migrationAdmin.from('subscription_cancellation_requests')
    .select('status,last_error').eq('id', raceRequest.cancellationRequestId).single()
  assert.ifError(raceState.error)
  assert.equal(raceState.data?.status, 'requires_reconciliation')
  assert.equal(raceState.data?.last_error, 'period_end_cancellation_renewal_race')
  const renewedSubscription = await migrationAdmin.from('billing_subscriptions')
    .select('status,current_period_end').eq('id', renewalRace.subscriptionId).single()
  assert.ifError(renewedSubscription.error)
  assert.equal(renewedSubscription.data?.status, 'active')
  assert.equal(Date.parse(String(renewedSubscription.data?.current_period_end)), Date.parse('2001-05-01T09:00:00.000Z'))
  assert.equal((await migrationAdmin.from('billing_reconciliation_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('restaurant_id', renewalRace.restaurantId)
    .eq('dedupe_key', `period-end-cancellation-race:${raceRequest.cancellationRequestId}`)).count, 1)
  console.log('F ✅ renewal race retained the advanced paid period and created one reconciliation job')
}

async function run() {
  try {
    await main()
  } finally {
    await cleanup()
    for (const restaurantId of restaurantIds) {
      assert.equal((await admin.from('restaurants').select('id', { count: 'exact', head: true })
        .eq('id', restaurantId)).count, 0)
    }
    console.log('G ✅ period-end cancellation DEV fixtures removed')
  }
}

void run().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
