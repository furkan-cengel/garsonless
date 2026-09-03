import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { createSubscriptionBillingOperationsPort } from '../src/subscription-billing-operations-port'
import type { Database } from '../src/types.gen'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
assert(url && serviceRoleKey, 'DEV Supabase runtime environment is required')
assert(url.includes('yxsegwkzyiscrxiwdeuf'), 'Runtime verification must target DEV')
const options = {
  auth: { autoRefreshToken: false, persistSession: false },
} as const
const admin = createClient<Database>(url, serviceRoleKey, options)
const migrationAdmin = createClient(url, serviceRoleKey, options)
type Rpc = (
  name: string,
  args: Record<string, unknown>,
) => Promise<{
  data: unknown
  error: { code?: string; message: string } | null
}>
const rpc = admin.rpc.bind(admin) as unknown as Rpc
const operations = createSubscriptionBillingOperationsPort()
const marker = `plan-change-convergence-${Date.now()}-${randomUUID().slice(0, 8)}`
const restaurantIds: string[] = []

function object(value: unknown): Record<string, unknown> {
  assert(value && typeof value === 'object' && !Array.isArray(value))
  return value as Record<string, unknown>
}

async function cleanupFixture(restaurantId: string) {
  const outbox = await admin.from('domain_outbox').select('id').eq('restaurant_id', restaurantId)
  assert.ifError(outbox.error)
  const outboxIds = outbox.data?.map((row) => row.id) ?? []
  if (outboxIds.length) {
    assert.ifError((await admin.from('domain_outbox_receipts').delete().in('outbox_id', outboxIds)).error)
  }
  for (const table of [
    'notification_deliveries',
    'notification_inbox',
    'domain_outbox',
    'table_sessions',
    'tables',
    'tenant_lifecycle_events',
    'dunning_runs',
    'billing_reconciliation_jobs',
    'accounting_review_jobs',
    'accounting_invoice_jobs',
    'billing_provider_operations',
    'billing_subscription_provider_refs',
    'subscription_change_requests',
    'restaurant_subscription_add_ons',
    'billing_provider_events',
    'subscription_payment_attempts',
    'subscription_invoices',
    'billing_subscriptions',
    'billing_customers',
  ]) {
    const deleted = await migrationAdmin.from(table).delete().eq('restaurant_id', restaurantId)
    assert.ifError(deleted.error)
  }
  assert.ifError((await admin.from('restaurants').delete().eq('id', restaurantId)).error)
}

async function cleanup() {
  const fixtures = await admin.from('restaurants').select('id').like('slug', 'plan-change-convergence-%')
  assert.ifError(fixtures.error)
  for (const fixture of fixtures.data ?? []) await cleanupFixture(fixture.id)
}

async function createFixture(input: {
  suffix: string
  ownerId: string
  fromPlan: 'plus' | 'pro'
  toPlan: 'plus' | 'pro'
  withOpenSession: boolean
}) {
  const slug = `${marker}-${input.suffix}`
  const restaurant = await admin
    .from('restaurants')
    .insert({
      owner_id: input.ownerId,
      name: slug,
      slug,
      plan: input.fromPlan,
    })
    .select('id')
    .single()
  assert.ifError(restaurant.error)
  const restaurantId = restaurant.data!.id
  restaurantIds.push(restaurantId)
  const customerRef = `${slug}:customer`
  const parentRef = `${slug}:parent`
  const childRef = `${slug}:child`
  const fromPlanRef = `${slug}:plan-${input.fromPlan}-monthly`
  const targetPlanRef = `${slug}:plan-${input.toPlan}-monthly`
  const customer = await admin
    .from('billing_customers')
    .insert({
      restaurant_id: restaurantId,
      legal_name: slug,
      contact_email: `${slug}@example.invalid`,
      provider_customer_ref: customerRef,
    })
    .select('id')
    .single()
  assert.ifError(customer.error)
  const subscription = await migrationAdmin
    .from('billing_subscriptions')
    .insert({
      restaurant_id: restaurantId,
      billing_customer_id: customer.data!.id,
      provider: 'iyzico',
      provider_subscription_ref: parentRef,
      provider_plan_ref: fromPlanRef,
      plan: input.fromPlan,
      billing_interval: 'monthly',
      status: 'active',
      current_period_start: '2026-09-01T00:00:00.000Z',
      current_period_end: '2026-10-01T00:00:00.000Z',
    })
    .select('id')
    .single()
  assert.ifError(subscription.error)

  let sessionId: string | null = null
  if (input.withOpenSession) {
    const table = await admin
      .from('tables')
      .insert({
        restaurant_id: restaurantId,
        label: `${input.suffix} table`,
      })
      .select('id')
      .single()
    assert.ifError(table.error)
    const session = await admin
      .from('table_sessions')
      .insert({
        restaurant_id: restaurantId,
        table_id: table.data!.id,
      })
      .select('id')
      .single()
    assert.ifError(session.error)
    sessionId = session.data!.id
  }

  const prepared = await operations.preparePlanChange({
    restaurantId,
    toPlan: input.toPlan,
    toAddOns: [],
    toBillingInterval: 'monthly',
    providerTargetPlanRef: targetPlanRef,
    effectivePolicy: 'next_period',
    idempotencyKey: `${slug}:change`,
    requestFingerprint: createHash('sha256').update(`${slug}:change`).digest('hex'),
    requestedBy: input.ownerId,
  })
  assert.ok(prepared.ok)
  assert.equal(prepared.value.dispatchable, true)
  const finalized = await operations.finalizePlanChange({
    operationId: prepared.value.operationId,
    changeRequestId: prepared.value.changeRequestId,
    occurredAt: '2026-09-01T12:00:00.000Z',
    result: {
      providerParentSubscriptionRef: parentRef,
      providerTargetSubscriptionRef: childRef,
      providerTargetPlanRef: targetPlanRef,
      providerStatus: 'active',
      providerPeriodStart: '2026-10-01T00:00:00.000Z',
      providerPeriodEnd: '2026-11-01T00:00:00.000Z',
    },
  })
  assert.ok(finalized.ok)
  return {
    restaurantId,
    subscriptionId: subscription.data!.id,
    changeRequestId: prepared.value.changeRequestId,
    customerRef,
    parentRef,
    childRef,
    targetPlanRef,
    sessionId,
    fromPlan: input.fromPlan,
    toPlan: input.toPlan,
  }
}

async function ingest(input: {
  eventId: string
  customerRef: string
  subscriptionRef: string
  orderRef: string
  occurredAt: string
}) {
  const payload = {
    iyziEventTime: Date.parse(input.occurredAt),
    customerReferenceCode: input.customerRef,
    subscriptionReferenceCode: input.subscriptionRef,
    orderReferenceCode: input.orderRef,
  }
  const result = await rpc('ingest_subscription_billing_provider_event', {
    p_provider_event_id: input.eventId,
    p_event_type: 'invoice.payment_succeeded',
    p_provider_customer_ref: input.customerRef,
    p_provider_subscription_ref: input.subscriptionRef,
    p_provider_invoice_ref: input.orderRef,
    p_payload_sanitized: payload,
    p_payload_hash: createHash('sha256').update(JSON.stringify(payload)).digest('hex'),
  })
  assert.ifError(result.error)
  return object(result.data)
}

async function hydrateTarget(input: {
  worker: string
  customerRef: string
  childRef: string
  orderRef: string
  targetPlanRef: string
  toPlan: 'plus' | 'pro'
}) {
  const claimed = await rpc('claim_subscription_invoice_hydration', {
    p_worker: input.worker,
    p_limit: 1,
    p_lease_seconds: 60,
  })
  assert.ifError(claimed.error)
  const jobs = claimed.data as Array<Record<string, unknown>>
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0]?.providerSubscriptionRef, input.childRef)
  const hydrated = await rpc('hydrate_subscription_invoice_with_payment_identity', {
    p_job_id: jobs[0]!.jobId,
    p_provider_event_id: jobs[0]!.providerEventId,
    p_worker: input.worker,
    p_provider_customer_ref: input.customerRef,
    p_provider_subscription_ref: input.childRef,
    p_provider_invoice_ref: input.orderRef,
    p_provider_plan_ref: input.targetPlanRef,
    p_plan: input.toPlan,
    p_add_ons: [],
    p_billing_interval: 'monthly',
    p_amount_minor: input.toPlan === 'pro' ? 143_880 : 83_880,
    p_currency: 'TRY',
    p_period_start: '2026-10-01T00:00:00.000Z',
    p_period_end: '2026-11-01T00:00:00.000Z',
    p_provider_order_status: 'succeeded',
    p_provider_payment_id: `${input.orderRef}:payment`,
    p_occurred_at: '2026-10-01T00:01:00.000Z',
  })
  assert.ifError(hydrated.error)
  return object(hydrated.data)
}

async function main() {
  await cleanup()
  const owner = await admin.from('restaurants').select('owner_id').eq('slug', 'test-cafe-b').single()
  assert.ifError(owner.error)

  const upgrade = await createFixture({
    suffix: 'upgrade',
    ownerId: owner.data!.owner_id,
    fromPlan: 'plus',
    toPlan: 'pro',
    withOpenSession: false,
  })
  const upgradeOrder = `${marker}:upgrade-order`
  const upgradeEvent = `${marker}:upgrade-event`
  const queuedUpgrade = await ingest({
    eventId: upgradeEvent,
    customerRef: upgrade.customerRef,
    subscriptionRef: upgrade.childRef,
    orderRef: upgradeOrder,
    occurredAt: '2026-10-01T00:01:00.000Z',
  })
  assert.equal(queuedUpgrade.dispatchable, false)
  assert.equal(queuedUpgrade.subscriptionId, upgrade.subscriptionId)
  const paidUpgrade = await hydrateTarget({
    worker: `${marker}:upgrade-worker`,
    customerRef: upgrade.customerRef,
    childRef: upgrade.childRef,
    orderRef: upgradeOrder,
    targetPlanRef: upgrade.targetPlanRef,
    toPlan: 'pro',
  })
  assert.equal(paidUpgrade.invoiceStatus, 'paid')
  const upgradeState = await migrationAdmin
    .from('billing_subscriptions')
    .select('plan,scheduled_plan,provider_subscription_ref,provider_plan_ref,current_period_start,current_period_end')
    .eq('id', upgrade.subscriptionId)
    .single()
  assert.ifError(upgradeState.error)
  assert.equal(upgradeState.data?.plan, 'pro')
  assert.equal(upgradeState.data?.scheduled_plan, null)
  assert.equal(upgradeState.data?.provider_subscription_ref, upgrade.childRef)
  assert.equal(upgradeState.data?.provider_plan_ref, upgrade.targetPlanRef)
  assert.equal(Date.parse(upgradeState.data!.current_period_start), Date.parse('2026-10-01T00:00:00.000Z'))
  const appliedUpgrade = await migrationAdmin
    .from('subscription_change_requests')
    .select('status,paid_invoice_id,paid_at,applied_at')
    .eq('id', upgrade.changeRequestId)
    .single()
  assert.ifError(appliedUpgrade.error)
  assert.equal(appliedUpgrade.data?.status, 'applied')
  assert.ok(appliedUpgrade.data?.paid_invoice_id)
  assert.ok(appliedUpgrade.data?.paid_at)
  assert.ok(appliedUpgrade.data?.applied_at)
  const upgradeRefs = await migrationAdmin
    .from('billing_subscription_provider_refs')
    .select('provider_subscription_ref,ref_role')
    .eq('restaurant_id', upgrade.restaurantId)
  assert.ifError(upgradeRefs.error)
  assert.deepEqual(
    new Map(upgradeRefs.data?.map((row: Record<string, unknown>) => [row.provider_subscription_ref, row.ref_role])),
    new Map([
      [upgrade.parentRef, 'previous'],
      [upgrade.childRef, 'current'],
    ]),
  )
  assert.equal(
    (
      await admin
        .from('domain_outbox')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', upgrade.restaurantId)
        .eq('event_type', 'plan.changed')
    ).count,
    1,
  )
  const upgradeReplay = await ingest({
    eventId: upgradeEvent,
    customerRef: upgrade.customerRef,
    subscriptionRef: upgrade.childRef,
    orderRef: upgradeOrder,
    occurredAt: '2026-10-01T00:01:00.000Z',
  })
  assert.equal(upgradeReplay.alreadyProcessed, true)
  assert.equal(
    (
      await admin
        .from('subscription_invoices')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', upgrade.restaurantId)
    ).count,
    1,
  )
  console.log('A ✅ child renewal paid evidence applied upgrade once and rotated provider lineage')

  const retired = await ingest({
    eventId: `${marker}:retired-event`,
    customerRef: upgrade.customerRef,
    subscriptionRef: upgrade.parentRef,
    orderRef: `${marker}:retired-order`,
    occurredAt: '2026-10-01T00:02:00.000Z',
  })
  assert.equal(retired.dispatchable, false)
  const retiredJob = await admin
    .from('billing_reconciliation_jobs')
    .select('discrepancy_code')
    .eq('dedupe_key', `iyzico-event:${marker}:retired-event`)
    .single()
  assert.ifError(retiredJob.error)
  assert.equal(retiredJob.data?.discrepancy_code, 'provider_subscription_reference_retired')
  const noRetiredHydration = await rpc('claim_subscription_invoice_hydration', {
    p_worker: `${marker}:retired-worker`,
    p_limit: 1,
    p_lease_seconds: 60,
  })
  assert.ifError(noRetiredHydration.error)
  assert.deepEqual(noRetiredHydration.data, [])
  console.log('B ✅ retired parent webhook stayed reconciliation-only and could not hydrate money state')

  const downgrade = await createFixture({
    suffix: 'downgrade',
    ownerId: owner.data!.owner_id,
    fromPlan: 'pro',
    toPlan: 'plus',
    withOpenSession: true,
  })
  const downgradeOrder = `${marker}:downgrade-order`
  await ingest({
    eventId: `${marker}:downgrade-event`,
    customerRef: downgrade.customerRef,
    subscriptionRef: downgrade.childRef,
    orderRef: downgradeOrder,
    occurredAt: '2026-10-01T00:01:00.000Z',
  })
  const paidDowngrade = await hydrateTarget({
    worker: `${marker}:downgrade-worker`,
    customerRef: downgrade.customerRef,
    childRef: downgrade.childRef,
    orderRef: downgradeOrder,
    targetPlanRef: downgrade.targetPlanRef,
    toPlan: 'plus',
  })
  assert.equal(paidDowngrade.invoiceStatus, 'paid')
  const draining = await migrationAdmin
    .from('billing_subscriptions')
    .select('plan,scheduled_plan,provider_subscription_ref,provider_plan_ref')
    .eq('id', downgrade.subscriptionId)
    .single()
  assert.ifError(draining.error)
  assert.equal(draining.data?.plan, 'pro')
  assert.equal(draining.data?.scheduled_plan, 'plus')
  assert.equal(draining.data?.provider_subscription_ref, downgrade.childRef)
  assert.equal(
    (await admin.from('restaurants').select('plan').eq('id', downgrade.restaurantId).single()).data?.plan,
    'pro',
  )
  assert.equal(
    (
      await migrationAdmin
        .from('subscription_change_requests')
        .select('status')
        .eq('id', downgrade.changeRequestId)
        .single()
    ).data?.status,
    'paid_draining',
  )
  const ingress = await rpc('read_tenant_order_ingress_status', {
    p_restaurant_id: downgrade.restaurantId,
  })
  assert.ifError(ingress.error)
  assert.equal(ingress.data, 'manual_hold')
  const applyWhileOpen = await rpc('apply_paid_subscription_plan_changes', {
    p_limit: 10,
    p_occurred_at: '2026-10-01T00:02:00.000Z',
  })
  assert.ifError(applyWhileOpen.error)
  assert.equal(applyWhileOpen.data, 0)
  assert.equal(
    (
      await admin
        .from('domain_outbox')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', downgrade.restaurantId)
        .eq('event_type', 'plan.changed')
    ).count,
    0,
  )
  console.log('C ✅ paid downgrade preserved Pro and blocked new ingress while an adisyon remained open')

  assert(downgrade.sessionId)
  assert.ifError(
    (
      await admin
        .from('table_sessions')
        .update({
          closed_at: '2026-10-01T00:03:00.000Z',
          updated_at: '2026-10-01T00:03:00.000Z',
        })
        .eq('id', downgrade.sessionId)
    ).error,
  )
  const applied = await rpc('apply_paid_subscription_plan_changes', {
    p_limit: 10,
    p_occurred_at: '2026-10-01T00:04:00.000Z',
  })
  assert.ifError(applied.error)
  assert.equal(applied.data, 1)
  const applyReplay = await rpc('apply_paid_subscription_plan_changes', {
    p_limit: 10,
    p_occurred_at: '2026-10-01T00:05:00.000Z',
  })
  assert.ifError(applyReplay.error)
  assert.equal(applyReplay.data, 0)
  const downgraded = await migrationAdmin
    .from('billing_subscriptions')
    .select('plan,scheduled_plan')
    .eq('id', downgrade.subscriptionId)
    .single()
  assert.ifError(downgraded.error)
  assert.equal(downgraded.data?.plan, 'plus')
  assert.equal(downgraded.data?.scheduled_plan, null)
  assert.equal(
    (await admin.from('restaurants').select('plan').eq('id', downgrade.restaurantId).single()).data?.plan,
    'plus',
  )
  assert.equal(
    (
      await migrationAdmin
        .from('subscription_change_requests')
        .select('status')
        .eq('id', downgrade.changeRequestId)
        .single()
    ).data?.status,
    'applied',
  )
  assert.equal(
    (
      await admin
        .from('domain_outbox')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', downgrade.restaurantId)
        .eq('event_type', 'plan.changed')
    ).count,
    1,
  )
  console.log('D ✅ closed adisyon released the paid downgrade once; maintenance replay was a no-op')
}

async function run() {
  try {
    await main()
  } finally {
    await cleanup()
    for (const restaurantId of restaurantIds) {
      assert.equal(
        (await admin.from('restaurants').select('id', { count: 'exact', head: true }).eq('id', restaurantId)).count,
        0,
      )
    }
    console.log('E ✅ plan-change convergence runtime fixtures removed')
  }
}

void run().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
