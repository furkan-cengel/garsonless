import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/types.gen'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
assert(url && anonKey && serviceRoleKey, 'Supabase runtime environment is required')

const options = { auth: { autoRefreshToken: false, persistSession: false } } as const
const admin = createClient<Database>(url, serviceRoleKey, options)
const anon = createClient<Database>(url, anonKey, options)
type Rpc = (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { code?: string; message: string } | null }>
const adminRpc = admin.rpc.bind(admin) as unknown as Rpc
const anonRpc = anon.rpc.bind(anon) as unknown as Rpc

const marker = `billing-transition-${Date.now()}-${randomUUID().slice(0, 8)}`
const restaurantIds: string[] = []

function row(value: unknown): Record<string, unknown> {
  assert(value && typeof value === 'object' && !Array.isArray(value), 'Expected RPC object result')
  return value as Record<string, unknown>
}

async function cleanup() {
  if (restaurantIds.length === 0) return
  await admin.from('domain_outbox_receipts').delete().in('outbox_id', (
    await admin.from('domain_outbox').select('id').in('restaurant_id', restaurantIds)
  ).data?.map((item) => item.id) ?? [])
  await admin.from('domain_outbox').delete().in('restaurant_id', restaurantIds)
  await admin.from('tenant_lifecycle_events').delete().in('restaurant_id', restaurantIds)
  await admin.from('dunning_runs').delete().in('restaurant_id', restaurantIds)
  await admin.from('billing_provider_events').delete().in('restaurant_id', restaurantIds)
  await admin.from('subscription_payment_attempts').delete().in('restaurant_id', restaurantIds)
  await admin.from('subscription_invoices').delete().in('restaurant_id', restaurantIds)
  await admin.from('billing_subscriptions').delete().in('restaurant_id', restaurantIds)
  await admin.from('billing_customers').delete().in('restaurant_id', restaurantIds)
  await admin.from('restaurants').delete().in('id', restaurantIds)
}

async function count(table: 'domain_outbox' | 'tenant_lifecycle_events' | 'dunning_runs' | 'billing_provider_events' | 'subscription_payment_attempts' | 'subscription_invoices' | 'billing_subscriptions' | 'billing_customers') {
  const { count: value, error } = await admin.from(table).select('id', { count: 'exact', head: true }).in('restaurant_id', restaurantIds)
  assert.ifError(error)
  return value ?? -1
}

async function assertCleanup() {
  const results = {
    outbox: await count('domain_outbox'), lifecycle: await count('tenant_lifecycle_events'),
    dunning: await count('dunning_runs'), events: await count('billing_provider_events'),
    attempts: await count('subscription_payment_attempts'), invoices: await count('subscription_invoices'),
    subscriptions: await count('billing_subscriptions'), customers: await count('billing_customers'),
  }
  for (const value of Object.values(results)) assert.equal(value, 0)
  const { count: restaurants, error } = await admin.from('restaurants').select('id', { count: 'exact', head: true }).in('id', restaurantIds)
  assert.ifError(error)
  assert.equal(restaurants, 0)
  console.log('G ✅ zero-orphan cleanup', { ...results, restaurants })
}

async function createTenant(ownerId: string, suffix: string, status: 'active' | 'manual_hold') {
  const { data: restaurant, error: restaurantError } = await admin.from('restaurants').insert({
    owner_id: ownerId, name: `Billing transition ${suffix} ${marker}`, slug: `${marker}-${suffix}`, plan: 'starter',
  }).select('id, plan').single()
  assert.ifError(restaurantError)
  restaurantIds.push(restaurant!.id)
  const { data: customer, error: customerError } = await admin.from('billing_customers').insert({
    restaurant_id: restaurant!.id, legal_name: `${suffix} ${marker}`, contact_email: `${suffix}-${marker}@example.invalid`,
  }).select('id').single()
  assert.ifError(customerError)
  const { data: subscription, error: subscriptionError } = await admin.from('billing_subscriptions').insert({
    restaurant_id: restaurant!.id, billing_customer_id: customer!.id, plan: 'pro', status,
  }).select('id').single()
  assert.ifError(subscriptionError)
  return { restaurantId: restaurant!.id, subscriptionId: subscription!.id }
}

async function insertProviderEvent(input: { restaurantId: string; subscriptionId: string; type: 'invoice.payment_failed' | 'invoice.payment_succeeded'; suffix: string }) {
  const { data, error } = await admin.from('billing_provider_events').insert({
    restaurant_id: input.restaurantId,
    subscription_id: input.subscriptionId,
    provider_event_id: `${marker}:${input.suffix}`,
    event_type: input.type,
    payload_hash: `${marker}:sha256:${input.suffix}`,
    payload_sanitized: { fixture: input.suffix },
  }).select('id').single()
  assert.ifError(error)
  return data!.id
}

async function main() {
  const { data: fixture, error: fixtureError } = await admin.from('restaurants')
    .select('owner_id').eq('slug', 'test-cafe-b').is('deleted_at', null).single()
  assert.ifError(fixtureError)
  const tenant = await createTenant(fixture!.owner_id, 'active', 'active')
  const heldTenant = await createTenant(fixture!.owner_id, 'held', 'manual_hold')

  const denied = await anonRpc('create_subscription_invoice_atomic', {
    p_restaurant_id: tenant.restaurantId, p_subscription_id: tenant.subscriptionId, p_plan: 'pro', p_amount_minor: 14990,
    p_period_start: '2026-07-01T00:00:00Z', p_period_end: '2026-08-01T00:00:00Z',
    p_due_at: '2026-07-01T00:00:00Z', p_idempotency_key: `${marker}:anon`,
  })
  assert.equal(denied.error?.code, '42501')
  console.log('A ✅ anon RPC execution denied with 42501')

  const periodStart = new Date().toISOString()
  const periodEnd = new Date(Date.now() + 30 * 86_400_000).toISOString()
  const invoiceArgs = {
    p_restaurant_id: tenant.restaurantId, p_subscription_id: tenant.subscriptionId, p_plan: 'pro', p_amount_minor: 14_990,
    p_period_start: periodStart, p_period_end: periodEnd, p_due_at: periodStart,
    p_idempotency_key: `${marker}:invoice`,
  }
  const firstInvoice = await adminRpc('create_subscription_invoice_atomic', invoiceArgs)
  assert.ifError(firstInvoice.error)
  const invoice = row(firstInvoice.data)
  assert.equal(invoice.duplicate, false)
  const invoiceReplay = await adminRpc('create_subscription_invoice_atomic', invoiceArgs)
  assert.ifError(invoiceReplay.error)
  assert.equal(row(invoiceReplay.data).duplicate, true)
  const invoiceId = String(invoice.invoiceId)
  assert.equal(await count('subscription_invoices'), 1)
  const { count: createdOutbox } = await admin.from('domain_outbox').select('id', { count: 'exact', head: true })
    .eq('restaurant_id', tenant.restaurantId).eq('event_type', 'invoice.created')
  assert.equal(createdOutbox, 1)
  console.log('B ✅ invoice + invoice.created committed once; replay returned duplicate')

  const failureEventId = await insertProviderEvent({ ...tenant, type: 'invoice.payment_failed', suffix: 'failed-1' })
  const failureArgs = {
    p_restaurant_id: tenant.restaurantId, p_subscription_id: tenant.subscriptionId, p_invoice_id: invoiceId,
    p_provider_event_id: failureEventId, p_provider_attempt_ref: `${marker}:attempt-failed`, p_amount_minor: 14_990,
    p_failure_code: 'fixture_declined', p_failure_message: 'Fixture decline', p_occurred_at: new Date().toISOString(),
    p_idempotency_key: `${marker}:failure`,
  }
  const failure = await adminRpc('record_subscription_payment_failure_atomic', failureArgs)
  assert.ifError(failure.error)
  assert.deepEqual({ invoiceStatus: row(failure.data).invoiceStatus, subscriptionStatus: row(failure.data).subscriptionStatus }, {
    invoiceStatus: 'past_due', subscriptionStatus: 'past_due',
  })
  const failureReplay = await adminRpc('record_subscription_payment_failure_atomic', failureArgs)
  assert.ifError(failureReplay.error)
  assert.equal(row(failureReplay.data).duplicate, true)
  const { count: failedAttempts } = await admin.from('subscription_payment_attempts').select('id', { count: 'exact', head: true })
    .eq('invoice_id', invoiceId).eq('status', 'failed')
  const { count: dunningRuns } = await admin.from('dunning_runs').select('id', { count: 'exact', head: true }).eq('invoice_id', invoiceId)
  assert.equal(failedAttempts, 1)
  assert.equal(dunningRuns, 1)
  console.log('C ✅ failure → past_due + one attempt + one dunning run; replay stayed single-row')

  const successEventId = await insertProviderEvent({ ...tenant, type: 'invoice.payment_succeeded', suffix: 'success-1' })
  const successArgs = {
    p_restaurant_id: tenant.restaurantId, p_subscription_id: tenant.subscriptionId, p_invoice_id: invoiceId,
    p_provider_event_id: successEventId, p_provider_attempt_ref: `${marker}:attempt-success`, p_amount_minor: 14_990,
    p_occurred_at: new Date().toISOString(), p_idempotency_key: `${marker}:success`,
  }
  const success = await adminRpc('record_subscription_payment_success_atomic', successArgs)
  assert.ifError(success.error)
  assert.equal(row(success.data).invoiceStatus, 'paid')
  assert.equal(row(success.data).subscriptionStatus, 'active')
  const successReplay = await adminRpc('record_subscription_payment_success_atomic', successArgs)
  assert.ifError(successReplay.error)
  assert.equal(row(successReplay.data).duplicate, true)
  const { data: paidInvoice } = await admin.from('subscription_invoices').select('status, amount_paid_minor').eq('id', invoiceId).single()
  const { data: activeSubscription } = await admin.from('billing_subscriptions').select('status').eq('id', tenant.subscriptionId).single()
  const { data: upgradedRestaurant } = await admin.from('restaurants').select('plan').eq('id', tenant.restaurantId).single()
  const { data: stoppedDunning } = await admin.from('dunning_runs').select('status').eq('invoice_id', invoiceId).single()
  assert.deepEqual(paidInvoice, { status: 'paid', amount_paid_minor: 14_990 })
  assert.equal(activeSubscription?.status, 'active')
  assert.equal(upgradedRestaurant?.plan, 'pro')
  assert.equal(stoppedDunning?.status, 'stopped')
  console.log('D ✅ first success paid invoice, restored active, projected Pro and stopped dunning; replay stayed idempotent')

  const lateFailureEventId = await insertProviderEvent({ ...tenant, type: 'invoice.payment_failed', suffix: 'late-failure' })
  const lateFailure = await adminRpc('record_subscription_payment_failure_atomic', {
    ...failureArgs, p_provider_event_id: lateFailureEventId, p_provider_attempt_ref: `${marker}:late-failure`,
    p_idempotency_key: `${marker}:late-failure`,
  })
  assert.ifError(lateFailure.error)
  assert.equal(row(lateFailure.data).ignoredBecausePaid, true)
  assert.equal(row(lateFailure.data).invoiceStatus, 'paid')
  assert.equal((await admin.from('subscription_payment_attempts').select('id', { count: 'exact', head: true }).eq('invoice_id', invoiceId)).count, 2)
  console.log('E ✅ late failure after success was processed without regressing paid state')

  const heldInvoice = await adminRpc('create_subscription_invoice_atomic', {
    ...invoiceArgs, p_restaurant_id: heldTenant.restaurantId, p_subscription_id: heldTenant.subscriptionId,
    p_idempotency_key: `${marker}:held-invoice`,
  })
  assert.ifError(heldInvoice.error)
  const heldInvoiceId = String(row(heldInvoice.data).invoiceId)
  const heldEventId = await insertProviderEvent({ ...heldTenant, type: 'invoice.payment_succeeded', suffix: 'held-success' })
  const heldSuccess = await adminRpc('record_subscription_payment_success_atomic', {
    ...successArgs, p_restaurant_id: heldTenant.restaurantId, p_subscription_id: heldTenant.subscriptionId,
    p_invoice_id: heldInvoiceId, p_provider_event_id: heldEventId,
    p_provider_attempt_ref: `${marker}:held-attempt`, p_idempotency_key: `${marker}:held-success`,
  })
  assert.ifError(heldSuccess.error)
  assert.equal(row(heldSuccess.data).subscriptionStatus, 'manual_hold')
  assert.equal((await admin.from('restaurants').select('plan').eq('id', heldTenant.restaurantId).single()).data?.plan, 'starter')
  console.log('F ✅ paid callback did not clear manual_hold or unlock its entitlement projection')
}

async function run() {
  try { await main() } finally { await cleanup(); await assertCleanup() }
}

void run().catch((error: unknown) => { console.error(error); process.exitCode = 1 })
