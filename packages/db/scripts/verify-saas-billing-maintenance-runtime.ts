import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { processBillingMaintenanceBatch } from '@garsonless/application/billing-maintenance'
import { readSubscriptionBillingSettings } from '@garsonless/application/billing'
import { consumeDashboardInbox } from '@garsonless/application/notifications'
import { ok } from '@garsonless/domain/result'
import {
  createBillingMaintenancePort,
  createDashboardInboxPort,
  createSubscriptionBillingOperationsPort,
  createSubscriptionBillingSettingsReadPort,
} from '../src/server'
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
const marker = `bill-maint-${Date.now()}-${randomUUID().slice(0, 6)}`
const restaurantIds: string[] = []
let ownerId = ''

type Fixture = {
  restaurantId: string
  customerId: string
  subscriptionId: string
  invoiceId: string
  dunningRunId: string
}

function fingerprint(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function expectDenied(error: { code?: string } | null, label: string) {
  assert(error, `${label} unexpectedly succeeded`)
  assert.equal(error.code, '42501', `${label} must fail with 42501`)
}

async function authenticatedClient(userId: string): Promise<SupabaseClient<Database>> {
  const user = await admin.auth.admin.getUserById(userId)
  assert.ifError(user.error)
  assert(user.data.user?.email, 'Fixture owner email is required')
  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email: user.data.user.email })
  assert.ifError(link.error)
  const client = createClient<Database>(url!, anonKey!, options)
  const verified = await client.auth.verifyOtp({
    type: 'magiclink',
    token_hash: link.data.properties.hashed_token,
  })
  assert.ifError(verified.error)
  assert(verified.data.session, 'Expected a real authenticated session')
  return client
}

async function assertNoForeignClaimableWork() {
  const now = new Date().toISOString()
  const [dunning, reconciliation, operations] = await Promise.all([
    admin.from('dunning_runs').select('id, restaurant_id, status, next_action_at, locked_at'),
    admin.from('billing_reconciliation_jobs').select('id, restaurant_id, status, scheduled_at, locked_at'),
    admin.from('billing_provider_operations').select('id, restaurant_id, status, updated_at'),
  ])
  assert.ifError(dunning.error)
  assert.ifError(reconciliation.error)
  assert.ifError(operations.error)
  const nowMs = Date.parse(now)
  const claimableDunning = (dunning.data ?? []).filter((row) =>
    row.next_action_at && Date.parse(row.next_action_at) <= nowMs
    && (['scheduled', 'failed'].includes(row.status)
      || (row.status === 'running' && row.locked_at && Date.parse(row.locked_at) < nowMs - 60_000)),
  )
  const claimableReconciliation = (reconciliation.data ?? []).filter((row) =>
    Date.parse(row.scheduled_at) <= nowMs
    && (['pending', 'failed'].includes(row.status)
      || (row.status === 'running' && row.locked_at && Date.parse(row.locked_at) < nowMs - 60_000)),
  )
  const ambiguousOrStaleOperations = (operations.data ?? []).filter((row) =>
    row.status === 'requires_reconciliation'
    || (row.status === 'processing' && Date.parse(row.updated_at) < nowMs - 15 * 60_000)
    || (row.status === 'awaiting_callback' && Date.parse(row.updated_at) < nowMs - 24 * 60 * 60_000),
  )
  const foreign = [...claimableDunning, ...claimableReconciliation, ...ambiguousOrStaleOperations]
    .filter((row) => !restaurantIds.includes(row.restaurant_id))
  assert.equal(foreign.length, 0, `Refusing to claim ${foreign.length} non-fixture billing jobs`)
}

async function createFixture(suffix: string, nextActionAt: string): Promise<Fixture> {
  const restaurant = await admin.from('restaurants').insert({
    owner_id: ownerId,
    name: `Billing maintenance ${suffix} ${marker}`,
    slug: `${marker}-${suffix}`,
    plan: 'pro',
  }).select('id').single()
  assert.ifError(restaurant.error)
  restaurantIds.push(restaurant.data!.id)

  const address = {
    contactName: `Runtime ${suffix}`,
    city: 'Istanbul',
    district: 'Kadikoy',
    country: 'Turkey',
    address: 'Runtime test address',
    zipCode: '34000',
  }
  const customer = await admin.from('billing_customers').insert({
    restaurant_id: restaurant.data!.id,
    legal_name: `Runtime ${suffix} ${marker}`,
    contact_name: 'Runtime',
    contact_surname: suffix.toUpperCase(),
    identity_number: suffix === 'a' ? '11111111110' : '11111111111',
    contact_email: `${suffix}-${marker}@example.invalid`,
    gsm_number: '+905551112233',
    billing_address: address,
    shipping_address: address,
    profile_completed_at: new Date().toISOString(),
    provider_customer_ref: `${marker}:customer:${suffix}`,
  }).select('id').single()
  assert.ifError(customer.error)

  const periodStart = new Date(Date.now() - 32 * 86_400_000).toISOString()
  const periodEnd = new Date(Date.now() - 2 * 86_400_000).toISOString()
  const subscription = await admin.from('billing_subscriptions').insert({
    restaurant_id: restaurant.data!.id,
    billing_customer_id: customer.data!.id,
    plan: 'pro',
    status: 'past_due',
    provider_subscription_ref: `${marker}:subscription:${suffix}`,
    current_period_start: periodStart,
    current_period_end: periodEnd,
  }).select('id').single()
  assert.ifError(subscription.error)

  const failedAt = new Date().toISOString()
  const invoice = await admin.from('subscription_invoices').insert({
    restaurant_id: restaurant.data!.id,
    subscription_id: subscription.data!.id,
    provider_invoice_ref: `${marker}:invoice:${suffix}`,
    idempotency_key: `${marker}:invoice-key:${suffix}`,
    plan: 'pro',
    amount_due_minor: suffix === 'a' ? 14_990 : 9_990,
    status: 'past_due',
    period_start: periodStart,
    period_end: periodEnd,
    due_at: periodStart,
    finalized_at: periodStart,
    failed_at: failedAt,
  }).select('id').single()
  assert.ifError(invoice.error)

  const dunning = await admin.from('dunning_runs').insert({
    restaurant_id: restaurant.data!.id,
    subscription_id: subscription.data!.id,
    invoice_id: invoice.data!.id,
    policy_snapshot: {
      retryAfterDays: 1,
      secondWarningAfterDays: 3,
      finalWarningAfterDays: 7,
      suspendAfterDays: 14,
    },
    status: 'scheduled',
    current_step: 'retry',
    next_action_at: nextActionAt,
  }).select('id').single()
  assert.ifError(dunning.error)
  return {
    restaurantId: restaurant.data!.id,
    customerId: customer.data!.id,
    subscriptionId: subscription.data!.id,
    invoiceId: invoice.data!.id,
    dunningRunId: dunning.data!.id,
  }
}

async function due(runId: string, step: 'retry' | 'warning_3' | 'warning_7' | 'suspend') {
  const update = await admin.from('dunning_runs').update({
    status: 'scheduled',
    current_step: step,
    next_action_at: new Date(Date.now() - 60_000).toISOString(),
    locked_at: null,
    locked_by: null,
  }).eq('id', runId)
  assert.ifError(update.error)
}

async function cleanup() {
  if (restaurantIds.length === 0) return
  const outbox = await admin.from('domain_outbox').select('id').in('restaurant_id', restaurantIds)
  const outboxIds = (outbox.data ?? []).map((row) => row.id)
  if (outboxIds.length > 0) {
    await admin.from('notification_deliveries').delete().in('outbox_id', outboxIds)
    await admin.from('notification_inbox').delete().in('outbox_id', outboxIds)
    await admin.from('domain_outbox_receipts').delete().in('outbox_id', outboxIds)
  }
  await admin.from('domain_outbox').delete().in('restaurant_id', restaurantIds)
  await admin.from('billing_reconciliation_jobs').delete().in('restaurant_id', restaurantIds)
  await admin.from('billing_provider_operations').delete().in('restaurant_id', restaurantIds)
  await admin.from('tenant_lifecycle_events').delete().in('restaurant_id', restaurantIds)
  await admin.from('dunning_runs').delete().in('restaurant_id', restaurantIds)
  await admin.from('billing_provider_events').delete().in('restaurant_id', restaurantIds)
  await admin.from('subscription_payment_attempts').delete().in('restaurant_id', restaurantIds)
  await admin.from('subscription_invoices').delete().in('restaurant_id', restaurantIds)
  await admin.from('billing_subscriptions').delete().in('restaurant_id', restaurantIds)
  await admin.from('billing_customers').delete().in('restaurant_id', restaurantIds)
  await admin.from('restaurants').delete().in('id', restaurantIds)
}

async function assertCleanup() {
  const tables = [
    'notification_inbox', 'billing_reconciliation_jobs', 'billing_provider_operations',
    'tenant_lifecycle_events', 'dunning_runs', 'billing_provider_events',
    'subscription_payment_attempts', 'subscription_invoices', 'billing_subscriptions',
    'billing_customers', 'domain_outbox',
  ] as const
  const counts: Record<string, number> = {}
  for (const table of tables) {
    const result = await admin.from(table).select('id', { count: 'exact', head: true }).in('restaurant_id', restaurantIds)
    assert.ifError(result.error)
    counts[table] = result.count ?? -1
    assert.equal(result.count, 0, `${table} cleanup left orphans`)
  }
  const restaurants = await admin.from('restaurants').select('id', { count: 'exact', head: true }).in('id', restaurantIds)
  assert.ifError(restaurants.error)
  assert.equal(restaurants.count, 0)
  console.log('J ✅ zero-orphan cleanup', { ...counts, restaurants: restaurants.count })
}

async function main() {
  const fixtureOwner = await admin.from('restaurants').select('owner_id')
    .eq('slug', 'test-cafe-b').is('deleted_at', null).single()
  assert.ifError(fixtureOwner.error)
  ownerId = fixtureOwner.data!.owner_id
  const authenticated = await authenticatedClient(ownerId)

  await assertNoForeignClaimableWork()
  const deniedAnonSettings = await anonRpc('read_subscription_billing_settings', { p_restaurant_id: randomUUID() })
  const deniedAnonClaim = await anonRpc('claim_billing_dunning', { p_worker: marker, p_limit: 1, p_lease_seconds: 60 })
  const authenticatedRpc = authenticated.rpc.bind(authenticated) as unknown as Rpc
  const deniedAuthenticatedClaim = await authenticatedRpc('claim_billing_dunning', {
    p_worker: marker, p_limit: 1, p_lease_seconds: 60,
  })
  expectDenied(deniedAnonSettings.error, 'anon settings projection')
  expectDenied(deniedAnonClaim.error, 'anon dunning claim')
  expectDenied(deniedAuthenticatedClaim.error, 'authenticated dunning claim')
  console.log('A ✅ settings/maintenance RPCs are service-role only (anon + authenticated 42501)')

  const future = new Date(Date.now() + 86_400_000).toISOString()
  const dueNow = new Date(Date.now() - 60_000).toISOString()
  const tenantA = await createFixture('a', future)
  const tenantB = await createFixture('b', dueNow)
  await assertNoForeignClaimableWork()

  const maintenance = createBillingMaintenancePort()
  const workerA = `${marker}:lease-a`
  const workerB = `${marker}:lease-b`
  const firstLease = await maintenance.claimDunning({ workerId: workerA, limit: 10, leaseSeconds: 60 })
  assert(firstLease.ok)
  assert.deepEqual(firstLease.value.map((row) => row.runId), [tenantB.dunningRunId])
  const secondLease = await maintenance.claimDunning({ workerId: workerB, limit: 10, leaseSeconds: 60 })
  assert(secondLease.ok)
  assert.equal(secondLease.value.length, 0)
  const released = await maintenance.failDunning({
    runId: tenantB.dunningRunId, workerId: workerA, reason: 'runtime lease proof', retryDelaySeconds: 3600,
  })
  assert.deepEqual(released, ok(true))
  console.log('B ✅ concurrent worker lease: first claimed 1, second claimed 0')

  const settings = createSubscriptionBillingSettingsReadPort()
  const ownerContext = {
    actor: 'dashboard-member', userId: ownerId, restaurantId: tenantA.restaurantId,
    permissions: ['settings'], isOwner: true,
  } as const
  const memberContext = { ...ownerContext, isOwner: false } as const
  const ownerSettings = await readSubscriptionBillingSettings(ownerContext, tenantA.restaurantId, settings)
  assert(ownerSettings.ok)
  assert.equal(ownerSettings.value.subscription?.status, 'past_due')
  assert.equal(ownerSettings.value.invoices[0]?.amountDueMinor, 14_990)
  assert(!JSON.stringify(ownerSettings.value).includes('provider_'))
  assert.deepEqual(await readSubscriptionBillingSettings(memberContext, tenantA.restaurantId, settings), {
    ok: false, error: 'Billing owner context required',
  })
  assert.deepEqual(await readSubscriptionBillingSettings(ownerContext, tenantB.restaurantId, settings), {
    ok: false, error: 'Billing owner context required',
  })
  console.log('C ✅ owner projection works; member and cross-tenant contexts fail closed')

  const operations = createSubscriptionBillingOperationsPort()
  const crossTenant = await operations.prepareRetry({
    restaurantId: tenantA.restaurantId,
    invoiceId: tenantB.invoiceId,
    idempotencyKey: `${marker}:cross-tenant`,
    requestFingerprint: fingerprint(`${marker}:cross-tenant`),
  })
  assert.equal(crossTenant.ok, false)
  console.log('D ✅ cross-tenant retry composition rejected without an operation row')

  let providerCalls = 0
  const provider = {
    retryInvoice: async () => {
      providerCalls += 1
      return ok({ accepted: true as const })
    },
  }
  const workerContext = { actor: 'platform-billing-worker', provider: 'iyzico', workerId: `${marker}:worker` } as const
  await due(tenantA.dunningRunId, 'retry')
  await assertNoForeignClaimableWork()
  const retryBatch = await processBillingMaintenanceBatch(workerContext, { limit: 10, leaseSeconds: 60 }, maintenance, operations, provider)
  assert(retryBatch.ok)
  assert.deepEqual(retryBatch.value.dunning, { claimed: 1, advanced: 1, stopped: 0, failed: 0 })
  assert.equal(providerCalls, 1)
  assert.equal((await admin.from('billing_provider_operations').select('id', { count: 'exact', head: true })
    .eq('restaurant_id', tenantA.restaurantId).eq('operation_type', 'payment.retry')).count, 1)

  await due(tenantA.dunningRunId, 'retry')
  const replayBatch = await processBillingMaintenanceBatch(workerContext, { limit: 10, leaseSeconds: 60 }, maintenance, operations, provider)
  assert(replayBatch.ok)
  assert.equal(providerCalls, 1)
  assert.equal((await admin.from('domain_outbox').select('id', { count: 'exact', head: true })
    .eq('restaurant_id', tenantA.restaurantId).eq('event_type', 'billing.retry_requested')).count, 1)
  console.log('E ✅ retry replay kept one provider dispatch, one operation and one outbox event')

  await due(tenantA.dunningRunId, 'warning_3')
  const warning3 = await processBillingMaintenanceBatch(workerContext, { limit: 10, leaseSeconds: 60 }, maintenance, operations, provider)
  assert(warning3.ok)
  await due(tenantA.dunningRunId, 'warning_7')
  const warning7 = await processBillingMaintenanceBatch(workerContext, { limit: 10, leaseSeconds: 60 }, maintenance, operations, provider)
  assert(warning7.ok)
  assert.equal((await admin.from('billing_subscriptions').select('status').eq('id', tenantA.subscriptionId).single()).data?.status, 'grace_period')
  await due(tenantA.dunningRunId, 'suspend')
  const suspended = await processBillingMaintenanceBatch(workerContext, { limit: 10, leaseSeconds: 60 }, maintenance, operations, provider)
  assert(suspended.ok)
  const [subscriptionState, tenantState, runState] = await Promise.all([
    admin.from('billing_subscriptions').select('status').eq('id', tenantA.subscriptionId).single(),
    admin.from('restaurants').select('plan').eq('id', tenantA.restaurantId).single(),
    admin.from('dunning_runs').select('status').eq('id', tenantA.dunningRunId).single(),
  ])
  assert.equal(subscriptionState.data?.status, 'suspended')
  assert.equal(tenantState.data?.plan, 'starter')
  assert.equal(runState.data?.status, 'completed')
  const lifecycle = await admin.from('tenant_lifecycle_events').select('to_status, reason_code')
    .eq('restaurant_id', tenantA.restaurantId).order('occurred_at')
  assert.deepEqual(lifecycle.data?.map((row) => row.to_status), ['grace_period', 'suspended'])
  console.log('F ✅ warning_3 → warning_7/grace → suspend; tenant plan projected to starter')

  const ambiguous = await operations.prepareRetry({
    restaurantId: tenantB.restaurantId,
    invoiceId: tenantB.invoiceId,
    idempotencyKey: `${marker}:ambiguous-retry`,
    requestFingerprint: fingerprint(`${marker}:ambiguous-retry`),
  })
  assert(ambiguous.ok && ambiguous.value.dispatchable)
  assert.deepEqual(await operations.markOperationForReconciliation({
    operationId: ambiguous.value.operationId, reason: 'runtime ambiguous provider result',
  }), ok(true))
  const paid = await admin.from('subscription_invoices').update({
    status: 'paid', amount_paid_minor: 9_990, paid_at: new Date().toISOString(),
  }).eq('id', tenantB.invoiceId)
  assert.ifError(paid.error)
  await due(tenantB.dunningRunId, 'warning_3')
  await assertNoForeignClaimableWork()
  const reconcileBatch = await processBillingMaintenanceBatch(workerContext, { limit: 10, leaseSeconds: 60 }, maintenance, operations, provider)
  assert(reconcileBatch.ok)
  assert.equal(reconcileBatch.value.dunning.stopped, 1)
  assert.equal(reconcileBatch.value.reconciliation.escalated, 1)
  assert.equal(providerCalls, 1)
  const reconciliation = await admin.from('billing_reconciliation_jobs')
    .select('status, discrepancy_code').eq('restaurant_id', tenantB.restaurantId).single()
  assert.deepEqual(reconciliation.data, { status: 'discrepancy', discrepancy_code: 'manual_review_required' })
  console.log('G ✅ paid invoice stopped dunning; ambiguous provider result escalated once without redispatch')

  const requiredEvents = await admin.from('domain_outbox').select('id, event_type')
    .eq('restaurant_id', tenantA.restaurantId)
    .in('event_type', ['billing.warning_7', 'tenant.suspended'])
  assert.ifError(requiredEvents.error)
  const reconciliationEvent = await admin.from('domain_outbox').select('id, event_type')
    .eq('restaurant_id', tenantB.restaurantId).eq('event_type', 'billing.reconciliation_required').single()
  assert.ifError(reconciliationEvent.error)
  const inboxEvents = [...(requiredEvents.data ?? []), reconciliationEvent.data!]
  assert.equal(inboxEvents.length, 3)
  for (const event of inboxEvents) {
    const consumed = await consumeDashboardInbox(event.id, createDashboardInboxPort())
    assert(consumed.ok)
    assert.deepEqual({ recipients: consumed.value.recipients, delivered: consumed.value.delivered }, { recipients: 1, delivered: 1 })
  }
  const duplicate = await consumeDashboardInbox(inboxEvents[0]!.id, createDashboardInboxPort())
  assert(duplicate.ok && duplicate.value.duplicate)
  const inbox = await admin.from('notification_inbox').select('category, severity, recipient_user_id')
    .in('restaurant_id', restaurantIds)
  assert.ifError(inbox.error)
  assert.equal(inbox.data?.length, 3)
  assert(inbox.data?.every((row) => row.recipient_user_id === ownerId))
  assert(inbox.data?.some((row) => row.severity === 'critical'))
  console.log('H ✅ mandatory billing/system events reached owner-only inbox once; replay was duplicate')

  const tenantBSettings = await readSubscriptionBillingSettings(
    { ...ownerContext, restaurantId: tenantB.restaurantId }, tenantB.restaurantId, settings,
  )
  assert(tenantBSettings.ok)
  assert.equal(tenantBSettings.value.attention.reconciliationCount, 1)
  assert(!JSON.stringify(tenantBSettings.value).includes('runtime ambiguous provider result'))
  console.log('I ✅ owner settings exposes one safe reconciliation issue without provider/error internals')
}

async function run() {
  try {
    await main()
  } finally {
    await cleanup()
    await assertCleanup()
  }
}

const keepAlive = setInterval(() => undefined, 1_000)
run().then(
  () => console.log('K ✅ Phase 5 maintenance runtime matrix complete'),
  (error: unknown) => {
    console.error(error)
    process.exitCode = 1
  },
).finally(() => clearInterval(keepAlive))
