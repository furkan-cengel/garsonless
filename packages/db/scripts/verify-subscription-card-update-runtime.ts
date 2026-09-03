import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
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
const marker = `card-update-runtime-${Date.now()}-${randomUUID().slice(0, 8)}`
let restaurantId: string | null = null

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

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
    'restaurant_subscription_add_ons', 'subscription_payment_attempts',
    'subscription_invoices', 'billing_subscriptions', 'billing_customers',
  ]) {
    const deleted = await migrationAdmin.from(table).delete().eq('restaurant_id', id)
    assert.ifError(deleted.error)
  }
  assert.ifError((await admin.from('restaurants').delete().eq('id', id)).error)
}

async function cleanup() {
  const fixtures = await admin.from('restaurants').select('id').like('slug', 'card-update-runtime-%')
  assert.ifError(fixtures.error)
  for (const fixture of fixtures.data ?? []) await cleanupFixture(fixture.id)
}

async function main() {
  await cleanup()
  const occurredAt = new Date().toISOString()
  const driftOccurredAt = new Date(Date.now() + 60_000).toISOString()
  const expiresAt = new Date(Date.now() + 30 * 60_000).toISOString()
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
    provider: 'iyzico', provider_subscription_ref: `${marker}:subscription`,
    provider_plan_ref: `${marker}:plan-plus-monthly`,
    plan: 'plus', billing_interval: 'monthly', status: 'active',
    current_period_start: '2026-09-01T00:00:00.000Z',
    current_period_end: '2026-10-01T00:00:00.000Z',
  }).select('id').single()
  assert.ifError(subscription.error)

  const port = createSubscriptionBillingOperationsPort()
  const callbackState = randomUUID().replaceAll('-', '')
  const prepareInput = {
    restaurantId,
    idempotencyKey: `${marker}:initialize`,
    requestFingerprint: sha256(`${marker}:request`),
    callbackStateHash: sha256(callbackState),
  }
  const prepared = await port.prepareCardUpdate(prepareInput)
  assert.ok(prepared.ok)
  assert.equal(prepared.value.dispatchable, true)
  assert.equal(prepared.value.duplicate, false)
  const replayedPrepare = await port.prepareCardUpdate(prepareInput)
  assert.ok(replayedPrepare.ok)
  assert.equal(replayedPrepare.value.operationId, prepared.value.operationId)
  assert.equal(replayedPrepare.value.dispatchable, false)
  assert.equal(replayedPrepare.value.duplicate, true)
  assert.equal((await migrationAdmin.from('billing_provider_operations')
    .select('id', { count: 'exact', head: true }).eq('restaurant_id', restaurantId)
    .eq('operation_type', 'card_update.initialize')).count, 1)
  console.log('A ✅ initialize replay returned one durable operation and no second provider dispatch')

  const providerToken = `${marker}:token`
  const initialized = await port.markCardUpdateInitialized({
    operationId: prepared.value.operationId,
    providerCheckoutRef: providerToken,
    expiresAt,
  })
  assert.deepEqual(initialized, { ok: true, value: true })

  const concurrentReplay = await port.prepareCardUpdate({
    restaurantId,
    idempotencyKey: `${marker}:second-browser-request`,
    requestFingerprint: sha256(`${marker}:second-browser-request`),
    callbackStateHash: sha256(`${marker}:second-browser-state`),
  })
  assert.ok(concurrentReplay.ok)
  assert.equal(concurrentReplay.value.operationId, prepared.value.operationId)
  assert.equal(concurrentReplay.value.dispatchable, false)
  assert.equal(concurrentReplay.value.duplicate, true)
  assert.equal((await migrationAdmin.from('billing_provider_operations')
    .select('id', { count: 'exact', head: true }).eq('restaurant_id', restaurantId)
    .eq('operation_type', 'card_update.initialize')).count, 1)
  console.log('B ✅ a different browser request reused the awaiting callback without a unique-index error')

  const wrongState = await port.completeCardUpdate({
    providerCheckoutRef: providerToken,
    callbackState: 'x'.repeat(32),
    occurredAt,
  })
  assert.equal(wrongState.ok, false)
  assert.match(wrongState.ok ? '' : wrongState.error, /callback_state_mismatch/)
  assert.equal((await admin.from('domain_outbox').select('id', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId).eq('event_type', 'payment_method.updated')).count, 0)
  console.log('C ✅ wrong callback state failed closed with no notification or billing side effect')

  const completed = await port.completeCardUpdate({
    providerCheckoutRef: providerToken,
    callbackState,
    occurredAt,
  })
  assert.ok(completed.ok)
  assert.equal(completed.value.outcome, 'succeeded')
  assert.equal(completed.value.duplicate, false)
  const completedReplay = await port.completeCardUpdate({
    providerCheckoutRef: providerToken,
    callbackState,
    occurredAt,
  })
  assert.ok(completedReplay.ok)
  assert.equal(completedReplay.value.outcome, 'succeeded')
  assert.equal(completedReplay.value.duplicate, true)

  const outboxCount = (await admin.from('domain_outbox').select('id', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId).eq('event_type', 'payment_method.updated')).count
  assert.equal(outboxCount, 1)
  assert.equal((await admin.from('subscription_invoices').select('id', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId)).count, 0)
  assert.equal((await migrationAdmin.from('subscription_payment_attempts').select('id', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId)).count, 0)
  const localSubscription = await migrationAdmin.from('billing_subscriptions')
    .select('plan,status,provider_subscription_ref').eq('id', subscription.data!.id).single()
  assert.ifError(localSubscription.error)
  assert.deepEqual(localSubscription.data, {
    plan: 'plus', status: 'active', provider_subscription_ref: `${marker}:subscription`,
  })
  const localRestaurant = await admin.from('restaurants').select('plan').eq('id', restaurantId).single()
  assert.ifError(localRestaurant.error)
  assert.equal(localRestaurant.data?.plan, 'plus')
  const operation = await migrationAdmin.from('billing_provider_operations')
    .select('callback_state_hash,result_sanitized,status').eq('id', prepared.value.operationId).single()
  assert.ifError(operation.error)
  assert.equal(operation.data?.callback_state_hash, sha256(callbackState))
  assert.equal(operation.data?.status, 'succeeded')
  const persisted = JSON.stringify(operation.data)
  assert.equal(persisted.includes(callbackState), false)
  for (const forbidden of ['cardNumber', 'cardHolderName', 'expireMonth', 'expireYear', 'cvc', 'cvv']) {
    assert.equal(persisted.toLowerCase().includes(forbidden.toLowerCase()), false)
  }
  console.log('D ✅ exact callback and replay emitted one event, no money/entitlement evidence, and no card data')

  const driftState = randomUUID().replaceAll('-', '')
  const driftPrepared = await port.prepareCardUpdate({
    restaurantId,
    idempotencyKey: `${marker}:drift-initialize`,
    requestFingerprint: sha256(`${marker}:drift-request`),
    callbackStateHash: sha256(driftState),
  })
  assert.ok(driftPrepared.ok)
  const driftToken = `${marker}:drift-token`
  assert.deepEqual(await port.markCardUpdateInitialized({
    operationId: driftPrepared.value.operationId,
    providerCheckoutRef: driftToken,
    expiresAt,
  }), { ok: true, value: true })
  assert.ifError((await migrationAdmin.from('billing_subscriptions').update({
    provider_subscription_ref: `${marker}:replacement-subscription`,
  }).eq('id', subscription.data!.id)).error)
  const drifted = await port.completeCardUpdate({
    providerCheckoutRef: driftToken,
    callbackState: driftState,
    occurredAt: driftOccurredAt,
  })
  assert.ok(drifted.ok)
  assert.equal(drifted.value.outcome, 'ambiguous')
  assert.equal((await admin.from('billing_reconciliation_jobs').select('id', { count: 'exact', head: true })
    .eq('dedupe_key', `provider-operation:${driftPrepared.value.operationId}`)).count, 1)
  assert.equal((await admin.from('domain_outbox').select('id', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId).eq('event_type', 'payment_method.updated')).count, 1)
  console.log('E ✅ provider lineage drift was quarantined for reconciliation without a false success event')
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
    console.log('F ✅ card update runtime fixtures removed')
  }
}

void run().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
