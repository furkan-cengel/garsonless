import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { processSubscriptionBillingWebhook } from '@garsonless/application/billing'
import {
  createSubscriptionBillingPersistencePort,
  createSubscriptionBillingWebhookInboxPort,
} from '../src/server'
import {
  createIyzicoSubscriptionWebhookVerifier,
  signIyzicoSubscriptionWebhookForTest,
} from '../../../apps/dashboard/lib/billing/iyzico-subscription-webhook'
import type { Database } from '../src/types.gen'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
assert(url && anonKey && serviceRoleKey, 'Supabase runtime environment is required')

const options = { auth: { autoRefreshToken: false, persistSession: false } } as const
const admin = createClient<Database>(url, serviceRoleKey, options)
const anon = createClient<Database>(url, anonKey, options)
type Rpc = (name: string, args: Record<string, unknown>) => Promise<{
  data: unknown
  error: { code?: string; message: string } | null
}>
const anonRpc = anon.rpc.bind(anon) as unknown as Rpc
const marker = `billing-webhook-${Date.now()}-${randomUUID().slice(0, 8)}`
const restaurantIds: string[] = []
const externalEventIds: string[] = []
const config = { merchantId: 'runtime-merchant', secretKey: `runtime-secret-${marker}` }
const verifier = createIyzicoSubscriptionWebhookVerifier(config)

type Fixture = {
  restaurantId: string
  customerRef: string
  subscriptionId: string
  subscriptionRef: string
}

function webhook(input: {
  eventId: string
  type: 'subscription.order.success' | 'subscription.order.failure'
  customerRef: string
  subscriptionRef: string
  invoiceRef: string
  eventTime?: number
}) {
  externalEventIds.push(input.eventId)
  const payload = {
    iyziReferenceCode: input.eventId,
    iyziEventType: input.type,
    iyziEventTime: input.eventTime ?? Date.now(),
    subscriptionReferenceCode: input.subscriptionRef,
    orderReferenceCode: input.invoiceRef,
    customerReferenceCode: input.customerRef,
  }
  return {
    rawBody: new TextEncoder().encode(JSON.stringify(payload)),
    headers: { 'x-iyz-signature-v3': signIyzicoSubscriptionWebhookForTest(config, payload) },
  }
}

async function cleanup() {
  await admin.from('billing_reconciliation_jobs').delete().in(
    'dedupe_key', externalEventIds.map((id) => `iyzico-event:${id}`),
  )
  await admin.from('billing_provider_events').delete().in('provider_event_id', externalEventIds)
  if (restaurantIds.length === 0) return
  const outboxIds = (await admin.from('domain_outbox').select('id').in('restaurant_id', restaurantIds)).data?.map((row) => row.id) ?? []
  if (outboxIds.length > 0) await admin.from('domain_outbox_receipts').delete().in('outbox_id', outboxIds)
  await admin.from('domain_outbox').delete().in('restaurant_id', restaurantIds)
  await admin.from('tenant_lifecycle_events').delete().in('restaurant_id', restaurantIds)
  await admin.from('dunning_runs').delete().in('restaurant_id', restaurantIds)
  await admin.from('subscription_payment_attempts').delete().in('restaurant_id', restaurantIds)
  await admin.from('subscription_invoices').delete().in('restaurant_id', restaurantIds)
  await admin.from('billing_subscriptions').delete().in('restaurant_id', restaurantIds)
  await admin.from('billing_customers').delete().in('restaurant_id', restaurantIds)
  await admin.from('restaurants').delete().in('id', restaurantIds)
}

async function assertCleanup() {
  const eventCount = (await admin.from('billing_provider_events').select('id', { count: 'exact', head: true })
    .in('provider_event_id', externalEventIds)).count
  const reconciliationCount = (await admin.from('billing_reconciliation_jobs').select('id', { count: 'exact', head: true })
    .in('dedupe_key', externalEventIds.map((id) => `iyzico-event:${id}`))).count
  const restaurantCount = (await admin.from('restaurants').select('id', { count: 'exact', head: true }).in('id', restaurantIds)).count
  assert.deepEqual({ eventCount, reconciliationCount, restaurantCount }, {
    eventCount: 0, reconciliationCount: 0, restaurantCount: 0,
  })
  console.log('H ✅ zero-orphan cleanup', { eventCount, reconciliationCount, restaurantCount })
}

async function createFixture(ownerId: string, suffix: string): Promise<Fixture> {
  const { data: restaurant, error: restaurantError } = await admin.from('restaurants').insert({
    owner_id: ownerId, name: `Billing webhook ${suffix} ${marker}`,
    slug: `${marker}-${suffix}`, plan: 'free',
  }).select('id').single()
  assert.ifError(restaurantError)
  restaurantIds.push(restaurant!.id)
  const customerRef = `${marker}:customer:${suffix}`
  const { data: customer, error: customerError } = await admin.from('billing_customers').insert({
    restaurant_id: restaurant!.id, legal_name: `${suffix} ${marker}`,
    contact_email: `${suffix}-${marker}@example.invalid`, provider_customer_ref: customerRef,
  }).select('id').single()
  assert.ifError(customerError)
  const subscriptionRef = `${marker}:subscription:${suffix}`
  const { data: subscription, error: subscriptionError } = await admin.from('billing_subscriptions').insert({
    restaurant_id: restaurant!.id, billing_customer_id: customer!.id, plan: 'pro',
    status: 'active', provider_subscription_ref: subscriptionRef,
  }).select('id').single()
  assert.ifError(subscriptionError)
  return { restaurantId: restaurant!.id, customerRef, subscriptionId: subscription!.id, subscriptionRef }
}

async function createInvoice(fixture: Fixture, suffix: string, amountMinor: number) {
  const start = new Date(Date.now() + (suffix === 'failure' ? 32 : 0) * 86_400_000)
  const end = new Date(start.getTime() + 30 * 86_400_000)
  const invoiceRef = `${marker}:invoice:${suffix}`
  const { data, error } = await admin.from('subscription_invoices').insert({
    restaurant_id: fixture.restaurantId, subscription_id: fixture.subscriptionId,
    provider_invoice_ref: invoiceRef, idempotency_key: `${marker}:invoice-key:${suffix}`,
    plan: 'pro', amount_due_minor: amountMinor, status: 'open',
    period_start: start.toISOString(), period_end: end.toISOString(),
    due_at: start.toISOString(), finalized_at: start.toISOString(),
  }).select('id').single()
  assert.ifError(error)
  return { invoiceId: data!.id, invoiceRef }
}

async function main() {
  const owner = await admin.from('restaurants').select('owner_id').eq('slug', 'test-cafe-b').single()
  assert.ifError(owner.error)
  const tenantA = await createFixture(owner.data!.owner_id, 'a')
  const tenantB = await createFixture(owner.data!.owner_id, 'b')
  const successInvoice = await createInvoice(tenantA, 'success', 14_990)
  const failureInvoice = await createInvoice(tenantA, 'failure', 9_990)
  const otherInvoice = await createInvoice(tenantB, 'other', 19_990)

  const denied = await anonRpc('ingest_subscription_billing_provider_event', {
    p_provider_event_id: `${marker}:anon`, p_event_type: 'invoice.payment_succeeded',
    p_provider_customer_ref: tenantA.customerRef, p_provider_subscription_ref: tenantA.subscriptionRef,
    p_provider_invoice_ref: successInvoice.invoiceRef, p_payload_sanitized: {}, p_payload_hash: 'denied',
  })
  assert.equal(denied.error?.code, '42501')
  console.log('A ✅ anon webhook inbox RPC denied with 42501')

  const invalidSignatureEvent = `${marker}:invalid-signature`
  externalEventIds.push(invalidSignatureEvent)
  const invalidSignature = await processSubscriptionBillingWebhook(
    {
      ...webhook({ eventId: invalidSignatureEvent, type: 'subscription.order.success', ...tenantA, invoiceRef: successInvoice.invoiceRef }),
      headers: { 'x-iyz-signature-v3': '0'.repeat(64) },
    }, verifier, createSubscriptionBillingWebhookInboxPort(), createSubscriptionBillingPersistencePort(),
  )
  assert.equal(invalidSignature.ok, false)
  assert.equal((await admin.from('billing_provider_events').select('id', { count: 'exact', head: true }).eq('provider_event_id', invalidSignatureEvent)).count, 0)
  console.log('B ✅ invalid signature rejected before service-role persistence')

  const successEvent = `${marker}:success`
  const successInput = webhook({
    eventId: successEvent, type: 'subscription.order.success', customerRef: tenantA.customerRef,
    subscriptionRef: tenantA.subscriptionRef, invoiceRef: successInvoice.invoiceRef,
  })
  const success = await processSubscriptionBillingWebhook(
    successInput, verifier, createSubscriptionBillingWebhookInboxPort(), createSubscriptionBillingPersistencePort(),
  )
  assert.equal(success.ok && success.value.outcome, 'processed')
  const replay = await processSubscriptionBillingWebhook(
    successInput, verifier, createSubscriptionBillingWebhookInboxPort(), createSubscriptionBillingPersistencePort(),
  )
  assert.equal(replay.ok && replay.value.outcome, 'duplicate')
  const paid = await admin.from('subscription_invoices').select('status, amount_paid_minor').eq('id', successInvoice.invoiceId).single()
  assert.deepEqual(paid.data, { status: 'paid', amount_paid_minor: 14_990 })
  assert.equal((await admin.from('subscription_payment_attempts').select('id', { count: 'exact', head: true }).eq('invoice_id', successInvoice.invoiceId)).count, 1)
  console.log('C ✅ signed success used local ₺149.90 invoice amount; replay stayed one attempt')

  const failureEvent = `${marker}:failure`
  const failure = await processSubscriptionBillingWebhook(webhook({
    eventId: failureEvent, type: 'subscription.order.failure', customerRef: tenantA.customerRef,
    subscriptionRef: tenantA.subscriptionRef, invoiceRef: failureInvoice.invoiceRef,
  }), verifier, createSubscriptionBillingWebhookInboxPort(), createSubscriptionBillingPersistencePort())
  assert.equal(failure.ok && failure.value.outcome, 'processed')
  const failed = await admin.from('subscription_invoices').select('status, amount_paid_minor').eq('id', failureInvoice.invoiceId).single()
  assert.deepEqual(failed.data, { status: 'past_due', amount_paid_minor: 0 })
  assert.equal((await admin.from('dunning_runs').select('id', { count: 'exact', head: true }).eq('invoice_id', failureInvoice.invoiceId)).count, 1)
  console.log('D ✅ signed failure used local ₺99.90 and atomically started one dunning run')

  const unmappedEvent = `${marker}:unmapped`
  const unmapped = await processSubscriptionBillingWebhook(webhook({
    eventId: unmappedEvent, type: 'subscription.order.success', customerRef: 'missing-customer',
    subscriptionRef: 'missing-subscription', invoiceRef: 'missing-invoice',
  }), verifier, createSubscriptionBillingWebhookInboxPort(), createSubscriptionBillingPersistencePort())
  assert.equal(unmapped.ok && unmapped.value.outcome, 'queued_for_reconciliation')
  assert.equal((await admin.from('billing_reconciliation_jobs').select('id', { count: 'exact', head: true }).eq('dedupe_key', `iyzico-event:${unmappedEvent}`)).count, 1)
  console.log('E ✅ unmapped signed event durably queued once without changing money')

  const crossEvent = `${marker}:cross-tenant`
  const cross = await processSubscriptionBillingWebhook(webhook({
    eventId: crossEvent, type: 'subscription.order.success', customerRef: tenantA.customerRef,
    subscriptionRef: tenantA.subscriptionRef, invoiceRef: otherInvoice.invoiceRef,
  }), verifier, createSubscriptionBillingWebhookInboxPort(), createSubscriptionBillingPersistencePort())
  assert.equal(cross.ok && cross.value.outcome, 'queued_for_reconciliation')
  assert.equal((await admin.from('subscription_payment_attempts').select('id', { count: 'exact', head: true }).eq('invoice_id', otherInvoice.invoiceId)).count, 0)
  console.log('F ✅ cross-tenant subscription/invoice references failed closed and queued reconciliation')

  const conflictInput = webhook({
    eventId: successEvent, type: 'subscription.order.success', customerRef: tenantA.customerRef,
    subscriptionRef: tenantA.subscriptionRef, invoiceRef: successInvoice.invoiceRef,
    eventTime: Date.now() - 2_000,
  })
  const conflict = await processSubscriptionBillingWebhook(
    conflictInput, verifier, createSubscriptionBillingWebhookInboxPort(), createSubscriptionBillingPersistencePort(),
  )
  assert.equal(conflict.ok, false)
  assert.match(conflict.ok ? '' : conflict.error, /idempotency_conflict/)
  console.log('G ✅ same provider event id with a changed payload was rejected as idempotency conflict')
}

async function run() {
  try { await main() } finally { await cleanup(); await assertCleanup() }
}

void run().catch((error: unknown) => { console.error(error); process.exitCode = 1 })
