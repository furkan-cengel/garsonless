import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { createSubscriptionBillingOperationsPort } from '../src/subscription-billing-operations-port'
import type { Database } from '../src/types.gen'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
assert(url && serviceRoleKey, 'DEV Supabase runtime environment is required')
assert(url.includes('yxsegwkzyiscrxiwdeuf'), 'Runtime verification must target DEV')
const options = { auth: { autoRefreshToken: false, persistSession: false } } as const
const admin = createClient<Database>(url, serviceRoleKey, options)
const migrationAdmin = createClient(url, serviceRoleKey, options)
const marker = `plan-change-ledger-${Date.now()}-${randomUUID().slice(0, 8)}`
let restaurantId: string | null = null

async function cleanupFixture(id: string) {
  const outbox = await admin.from('domain_outbox').select('id').eq('restaurant_id', id)
  assert.ifError(outbox.error)
  const outboxIds = outbox.data?.map((row) => row.id) ?? []
  if (outboxIds.length) {
    assert.ifError((await admin.from('domain_outbox_receipts').delete().in('outbox_id', outboxIds)).error)
  }
  for (const table of [
    'notification_deliveries', 'notification_inbox', 'domain_outbox',
    'billing_reconciliation_jobs', 'billing_subscription_provider_refs',
    'billing_provider_operations', 'subscription_change_requests',
    'restaurant_subscription_add_ons', 'subscription_invoices',
    'billing_subscriptions', 'billing_customers',
  ]) {
    const deleted = await migrationAdmin.from(table).delete().eq('restaurant_id', id)
    assert.ifError(deleted.error)
  }
  assert.ifError((await admin.from('restaurants').delete().eq('id', id)).error)
}

async function cleanup() {
  const fixtures = await admin.from('restaurants').select('id').like('slug', 'plan-change-ledger-%')
  assert.ifError(fixtures.error)
  for (const fixture of fixtures.data ?? []) await cleanupFixture(fixture.id)
}

async function main() {
  await cleanup()
  const owner = await admin.from('restaurants').select('owner_id').eq('slug', 'test-cafe-b').single()
  assert.ifError(owner.error)
  const restaurant = await admin.from('restaurants').insert({
    owner_id: owner.data!.owner_id, name: marker, slug: marker, plan: 'plus',
  }).select('id').single()
  assert.ifError(restaurant.error)
  restaurantId = restaurant.data!.id
  const customer = await admin.from('billing_customers').insert({
    restaurant_id: restaurantId, legal_name: marker,
    contact_email: `${marker}@example.invalid`, provider_customer_ref: `${marker}:customer`,
  }).select('id').single()
  assert.ifError(customer.error)
  const subscription = await migrationAdmin.from('billing_subscriptions').insert({
    restaurant_id: restaurantId, billing_customer_id: customer.data!.id,
    provider: 'iyzico', provider_subscription_ref: `${marker}:parent`,
    provider_plan_ref: `${marker}:plan-plus-monthly`,
    plan: 'plus', billing_interval: 'monthly', status: 'active',
    current_period_start: '2026-09-01T00:00:00.000Z',
    current_period_end: '2026-10-01T00:00:00.000Z',
  }).select('id').single()
  assert.ifError(subscription.error)

  const port = createSubscriptionBillingOperationsPort()
  const unsupported = await port.preparePlanChange({
    restaurantId, toPlan: 'pro', toAddOns: [], toBillingInterval: 'annual',
    providerTargetPlanRef: `${marker}:plan-pro-annual`, effectivePolicy: 'next_period',
    idempotencyKey: `${marker}:interval-change`, requestFingerprint: 'a'.repeat(64),
    requestedBy: owner.data!.owner_id,
  })
  assert.equal(unsupported.ok, false)
  assert.match(unsupported.ok ? '' : unsupported.error, /interval_requires_checkout/)
  assert.equal((await migrationAdmin.from('subscription_change_requests')
    .select('id', { count: 'exact', head: true }).eq('restaurant_id', restaurantId)).count, 0)
  console.log('A ✅ interval change failed closed before durable provider dispatch')

  const prepared = await port.preparePlanChange({
    restaurantId, toPlan: 'pro', toAddOns: [], toBillingInterval: 'monthly',
    providerTargetPlanRef: `${marker}:plan-pro-monthly`, effectivePolicy: 'next_period',
    idempotencyKey: `${marker}:same-interval`, requestFingerprint: 'b'.repeat(64),
    requestedBy: owner.data!.owner_id,
  })
  assert.ok(prepared.ok)
  assert.equal(prepared.value.dispatchable, true)
  assert.equal(prepared.value.effectivePolicy, 'next_period')

  const quarantined = await port.markOperationForReconciliation({
    operationId: prepared.value.operationId,
    reason: 'runtime simulates provider-success/local-timeout recovery',
  })
  assert.deepEqual(quarantined, { ok: true, value: true })
  const reconState = await migrationAdmin.from('subscription_change_requests')
    .select('status').eq('id', prepared.value.changeRequestId).single()
  assert.ifError(reconState.error)
  assert.equal(reconState.data?.status, 'requires_reconciliation')

  const finalized = await port.finalizePlanChange({
    operationId: prepared.value.operationId,
    changeRequestId: prepared.value.changeRequestId,
    occurredAt: '2026-09-01T12:00:00.000Z',
    result: {
      providerParentSubscriptionRef: `${marker}:parent`,
      providerTargetSubscriptionRef: `${marker}:child`,
      providerTargetPlanRef: `${marker}:plan-pro-monthly`,
      providerStatus: 'active',
      providerPeriodStart: '2026-10-01T00:00:00.000Z',
      providerPeriodEnd: '2026-11-01T00:00:00.000Z',
    },
  })
  assert.ok(finalized.ok)
  assert.equal(finalized.value.status, 'scheduled')
  const local = await migrationAdmin.from('billing_subscriptions')
    .select('plan,scheduled_plan,provider_subscription_ref,provider_plan_ref')
    .eq('id', subscription.data!.id).single()
  assert.ifError(local.error)
  assert.equal(local.data?.plan, 'plus')
  assert.equal(local.data?.scheduled_plan, 'pro')
  assert.equal(local.data?.provider_subscription_ref, `${marker}:parent`)
  const restaurantPlan = await admin.from('restaurants').select('plan').eq('id', restaurantId).single()
  assert.ifError(restaurantPlan.error)
  assert.equal(restaurantPlan.data?.plan, 'plus')
  assert.equal((await migrationAdmin.from('billing_subscription_provider_refs')
    .select('provider_subscription_ref', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId)).count, 2)
  const resolved = await admin.from('billing_reconciliation_jobs').select('status')
    .eq('dedupe_key', `provider-operation:${prepared.value.operationId}`).single()
  assert.ifError(resolved.error)
  assert.equal(resolved.data?.status, 'resolved')
  console.log('B ✅ exact provider child reference scheduled change and resolved its reconciliation without granting Pro')

  const replay = await port.finalizePlanChange({
    operationId: prepared.value.operationId,
    changeRequestId: prepared.value.changeRequestId,
    occurredAt: '2026-09-01T12:00:00.000Z',
    result: {
      providerParentSubscriptionRef: `${marker}:parent`,
      providerTargetSubscriptionRef: `${marker}:child`,
      providerTargetPlanRef: `${marker}:plan-pro-monthly`, providerStatus: 'active',
      providerPeriodStart: '2026-10-01T00:00:00.000Z',
      providerPeriodEnd: '2026-11-01T00:00:00.000Z',
    },
  })
  assert.ok(replay.ok)
  assert.equal(replay.value.duplicate, true)
  assert.equal((await admin.from('domain_outbox').select('id', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId).eq('event_type', 'plan.change_scheduled')).count, 1)
  assert.equal((await admin.from('subscription_invoices').select('id', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId)).count, 0)
  console.log('C ✅ finalize replay produced one scheduled notification and no invoice/payment evidence')
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
    console.log('D ✅ plan change ledger runtime fixtures removed')
  }
}

void run().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
