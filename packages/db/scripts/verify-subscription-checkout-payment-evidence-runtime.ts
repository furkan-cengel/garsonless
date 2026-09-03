import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/types.gen'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
assert(url && serviceRoleKey, 'DEV Supabase runtime environment is required')
assert(url.includes('yxsegwkzyiscrxiwdeuf'), 'Runtime verification must target the DEV Supabase project')

const options = { auth: { autoRefreshToken: false, persistSession: false } } as const
const admin = createClient<Database>(url, serviceRoleKey, options)
type Rpc = (name: string, args: Record<string, unknown>) => Promise<{
  data: unknown
  error: { code?: string; message: string } | null
}>
const rpc = admin.rpc.bind(admin) as unknown as Rpc

const marker = `checkout-evidence-${Date.now()}-${randomUUID().slice(0, 8)}`
let restaurantId: string | null = null
let operationId: string | null = null
let earlyEventId: string | null = null
let earlyReconciliationKey: string | null = null
let operationReconciliationKey: string | null = null

function row(value: unknown): Record<string, unknown> {
  assert(value && typeof value === 'object' && !Array.isArray(value), 'Expected object result')
  return value as Record<string, unknown>
}

async function cleanup() {
  const reconciliations = await admin.from('billing_reconciliation_jobs').delete()
    .like('dedupe_key', 'iyzico-event:checkout-evidence-%')
  assert.ifError(reconciliations.error)
  const fixtures = await admin.from('restaurants').select('id').like('slug', 'checkout-evidence-%')
  assert.ifError(fixtures.error)
  for (const fixture of fixtures.data ?? []) await cleanupRestaurant(fixture.id)
  // Early webhooks are intentionally persisted before a tenant mapping exists,
  // so their restaurant_id may remain null and cannot be found via the fixture.
  const earlyEvents = await admin.from('billing_provider_events').delete()
    .like('provider_event_id', 'checkout-evidence-%')
  assert.ifError(earlyEvents.error)
}

async function cleanupRestaurant(fixtureRestaurantId: string) {
  const outboxIds = (await admin.from('domain_outbox').select('id').eq('restaurant_id', fixtureRestaurantId)).data
    ?.map((item) => item.id) ?? []
  if (outboxIds.length > 0) await admin.from('domain_outbox_receipts').delete().in('outbox_id', outboxIds)
  const deletions = [
    await admin.from('domain_outbox').delete().eq('restaurant_id', fixtureRestaurantId),
    await admin.from('tenant_lifecycle_events').delete().eq('restaurant_id', fixtureRestaurantId),
    await admin.from('dunning_runs').delete().eq('restaurant_id', fixtureRestaurantId),
    await admin.from('billing_reconciliation_jobs').delete().eq('restaurant_id', fixtureRestaurantId),
    await admin.from('accounting_review_jobs').delete().eq('restaurant_id', fixtureRestaurantId),
    await admin.from('accounting_invoice_jobs').delete().eq('restaurant_id', fixtureRestaurantId),
    await admin.from('restaurant_subscription_add_ons').delete().eq('restaurant_id', fixtureRestaurantId),
    await admin.from('billing_provider_operations').delete().eq('restaurant_id', fixtureRestaurantId),
    await admin.from('billing_subscription_provider_refs').delete().eq('restaurant_id', fixtureRestaurantId),
    await admin.from('billing_provider_events').delete().eq('restaurant_id', fixtureRestaurantId),
    await admin.from('subscription_payment_attempts').delete().eq('restaurant_id', fixtureRestaurantId),
    await admin.from('subscription_invoices').delete().eq('restaurant_id', fixtureRestaurantId),
    await admin.from('billing_subscriptions').delete().eq('restaurant_id', fixtureRestaurantId),
    await admin.from('billing_customers').delete().eq('restaurant_id', fixtureRestaurantId),
  ]
  for (const deletion of deletions) assert.ifError(deletion.error)
  const deletedRestaurant = await admin.from('restaurants').delete().eq('id', fixtureRestaurantId)
  assert.ifError(deletedRestaurant.error)
}

async function assertCleanup() {
  if (!restaurantId) return
  const restaurantCount = (await admin.from('restaurants').select('id', { count: 'exact', head: true })
    .eq('id', restaurantId)).count
  const operationCount = operationId
    ? (await admin.from('billing_provider_operations').select('id', { count: 'exact', head: true })
      .eq('id', operationId)).count
    : 0
  const earlyEventCount = earlyEventId
    ? (await admin.from('billing_provider_events').select('id', { count: 'exact', head: true })
      .eq('id', earlyEventId)).count
    : 0
  assert.deepEqual({ restaurantCount, operationCount, earlyEventCount }, {
    restaurantCount: 0, operationCount: 0, earlyEventCount: 0,
  })
  console.log('E ✅ isolated DEV fixture removed without orphan rows')
}

async function main() {
  await cleanup()
  const owner = await admin.from('restaurants').select('owner_id').eq('slug', 'test-cafe-b').single()
  assert.ifError(owner.error)

  const restaurant = await admin.from('restaurants').insert({
    owner_id: owner.data!.owner_id,
    name: `Checkout evidence ${marker}`,
    slug: marker,
    plan: 'starter',
  }).select('id').single()
  assert.ifError(restaurant.error)
  restaurantId = restaurant.data!.id

  const customer = await admin.from('billing_customers').insert({
    restaurant_id: restaurantId,
    legal_name: `Checkout evidence ${marker}`,
    contact_email: `${marker}@example.invalid`,
  }).select('id').single()
  assert.ifError(customer.error)

  const subscription = await admin.from('billing_subscriptions').insert({
    restaurant_id: restaurantId,
    billing_customer_id: null,
    provider: null,
    plan: 'starter',
    intended_plan: 'pro',
    billing_interval: 'monthly',
    status: 'trial_expired',
  }).select('id').single()
  assert.ifError(subscription.error)

  // The atomic RPC verifies the provider period against PostgreSQL's calendar
  // month semantics. Keep the fixture away from month-end rollover ambiguity.
  const periodStartDate = new Date()
  periodStartDate.setUTCDate(10)
  periodStartDate.setUTCHours(12, 0, 0, 0)
  const periodEndDate = new Date(periodStartDate)
  periodEndDate.setUTCMonth(periodEndDate.getUTCMonth() + 1)
  const periodStart = periodStartDate.toISOString()
  const periodEnd = periodEndDate.toISOString()
  const providerCustomerRef = `${marker}:customer`
  const providerSubscriptionRef = `${marker}:subscription`
  const providerInvoiceRef = `${marker}:order`
  const providerPaymentId = `${marker}:payment`
  const providerPlanRef = `${marker}:plan`
  const operation = await admin.from('billing_provider_operations').insert({
    restaurant_id: restaurantId,
    billing_customer_id: customer.data!.id,
    operation_type: 'checkout.initialize',
    idempotency_key: `${marker}:operation`,
    request_fingerprint: 'a'.repeat(64),
    status: 'awaiting_callback',
    requested_plan: 'pro',
    requested_add_ons: ['iyzico_online_payments'],
    billing_interval: 'monthly',
    amount_minor: 179_880,
    currency: 'TRY',
    period_start: periodStart,
    period_end: periodEnd,
    due_at: periodStart,
    provider_checkout_ref: `${marker}:checkout`,
    provider_checkout_expires_at: periodEnd,
    result_sanitized: { expectedProviderPlanRef: providerPlanRef },
  }).select('id').single()
  assert.ifError(operation.error)
  operationId = operation.data!.id
  operationReconciliationKey = `provider-operation:${operationId}`
  const operationReconciliation = await admin.from('billing_reconciliation_jobs').insert({
    restaurant_id: restaurantId,
    provider: 'iyzico',
    scope: 'subscription',
    dedupe_key: operationReconciliationKey,
    local_snapshot: { operationId },
    provider_snapshot_sanitized: {},
  })
  assert.ifError(operationReconciliation.error)
  const storedBinding = await admin.from('billing_provider_operations')
    .select('result_sanitized').eq('id', operationId).single()
  assert.ifError(storedBinding.error)
  assert.equal(
    (storedBinding.data?.result_sanitized as Record<string, unknown>)?.expectedProviderPlanRef,
    providerPlanRef,
  )

  const forgedSuccess = await admin.from('billing_provider_operations')
    .update({ status: 'succeeded' }).eq('id', operationId)
  assert.equal(forgedSuccess.error?.code, 'P0001')
  assert.match(
    forgedSuccess.error?.message ?? '',
    /billing_checkout_(payment_invariant_broken|provider_plan_mismatch)/,
  )
  const rejectedOperation = await admin.from('billing_provider_operations')
    .select('status, invoice_id').eq('id', operationId).single()
  assert.ifError(rejectedOperation.error)
  assert.deepEqual(rejectedOperation.data, { status: 'awaiting_callback', invoice_id: null })
  console.log('A ✅ forged unpaid success was rejected and checkout remained awaiting_callback')

  const markedForReconciliation = await rpc('mark_subscription_billing_operation_reconciliation', {
    p_operation_id: operationId,
    p_reason: 'fixture_authenticated_checkout_requires_reconciliation',
  })
  assert.ifError(markedForReconciliation.error)
  assert.equal(markedForReconciliation.data, true)

  const providerEventId = `${marker}:early-webhook`
  earlyReconciliationKey = `iyzico-event:${providerEventId}`
  const early = await rpc('ingest_subscription_billing_provider_event', {
    p_provider_event_id: providerEventId,
    p_event_type: 'invoice.payment_succeeded',
    p_provider_customer_ref: providerCustomerRef,
    p_provider_subscription_ref: providerSubscriptionRef,
    p_provider_invoice_ref: providerInvoiceRef,
    p_payload_sanitized: {
      subscriptionReferenceCode: providerSubscriptionRef,
      orderReferenceCode: providerInvoiceRef,
      customerReferenceCode: providerCustomerRef,
    },
    p_payload_hash: 'b'.repeat(64),
  })
  assert.ifError(early.error)
  earlyEventId = String(row(early.data).providerEventId)
  assert.equal(row(early.data).dispatchable, false)
  console.log('B ✅ early signed-webhook projection is durable and queued while mapping is absent')

  const finalizeArgs = {
    p_operation_id: operationId,
    p_provider_customer_ref: providerCustomerRef,
    p_provider_subscription_ref: providerSubscriptionRef,
    p_provider_plan_ref: providerPlanRef,
    p_provider_invoice_ref: providerInvoiceRef,
    p_provider_payment_id: providerPaymentId,
    p_provider_order_status: 'succeeded',
    p_amount_minor: 179_880,
    p_currency: 'TRY',
    p_period_start: periodStart,
    p_period_end: periodEnd,
  }
  const finalized = await rpc('finalize_subscription_checkout_with_payment_identity', finalizeArgs)
  assert.ifError(finalized.error)
  assert.deepEqual({
    invoiceStatus: row(finalized.data).invoiceStatus,
    paymentEvidence: row(finalized.data).paymentEvidence,
    duplicate: row(finalized.data).duplicate,
  }, {
    invoiceStatus: 'paid', paymentEvidence: 'authenticated_retrieve', duplicate: false,
  })

  const invoiceId = String(row(finalized.data).invoiceId)
  const localState = await Promise.all([
    admin.from('subscription_invoices').select('status, amount_due_minor, amount_paid_minor, add_ons').eq('id', invoiceId).single(),
    admin.from('billing_subscriptions').select('status, plan, current_period_start, current_period_end').eq('id', subscription.data!.id).single(),
    admin.from('restaurants').select('plan').eq('id', restaurantId).single(),
    admin.from('restaurant_subscription_add_ons').select('status, subscription_id').eq('restaurant_id', restaurantId).single(),
    admin.from('subscription_payment_attempts').select('provider_attempt_ref, provider_payment_id')
      .eq('invoice_id', invoiceId).single(),
    admin.from('billing_provider_events').select('status').eq('id', earlyEventId).single(),
    admin.from('billing_reconciliation_jobs').select('status').eq('dedupe_key', earlyReconciliationKey).single(),
    admin.from('billing_reconciliation_jobs').select('status, local_snapshot')
      .eq('dedupe_key', operationReconciliationKey).single(),
  ])
  for (const result of localState) assert.ifError(result.error)
  assert.deepEqual(localState[0].data, {
    status: 'paid', amount_due_minor: 179_880, amount_paid_minor: 179_880,
    add_ons: ['iyzico_online_payments'],
  })
  assert.equal(localState[1].data?.status, 'active')
  assert.equal(localState[1].data?.plan, 'pro')
  assert.equal(localState[2].data?.plan, 'pro')
  assert.equal(localState[3].data?.status, 'active')
  assert.equal(localState[3].data?.subscription_id, subscription.data!.id)
  assert.deepEqual(localState[4].data, {
    provider_attempt_ref: providerInvoiceRef,
    provider_payment_id: providerPaymentId,
  })
  assert.equal(localState[5].data?.status, 'processed')
  assert.equal(localState[6].data?.status, 'resolved')
  assert.equal(localState[7].data?.status, 'resolved')
  assert.equal(
    (localState[7].data?.local_snapshot as Record<string, unknown>)?.resolvedBy,
    'authenticated_checkout_retrieve',
  )
  console.log('C ✅ authenticated retrieve atomically paid, bound paymentId, activated subscription/add-on, and resolved checkout/webhook races')

  const replay = await rpc('finalize_subscription_checkout_with_payment_identity', finalizeArgs)
  assert.ifError(replay.error)
  assert.equal(row(replay.data).duplicate, true)
  assert.equal(row(replay.data).invoiceStatus, 'paid')
  assert.equal((await admin.from('subscription_payment_attempts').select('id', { count: 'exact', head: true })
    .eq('invoice_id', invoiceId)).count, 1)
  console.log('D ✅ authenticated retrieve replay stayed one invoice and one successful attempt')
}

async function run() {
  try { await main() } finally { await cleanup(); await assertCleanup() }
}

void run().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
