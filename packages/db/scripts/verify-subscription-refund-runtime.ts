import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { createPlatformSubscriptionRefundPort } from '../src/subscription-refund-port'
import { createSubscriptionBillingSettingsReadPort } from '../src/subscription-billing-settings-port'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
assert(url && serviceRoleKey, 'DEV Supabase runtime environment is required')
assert.equal(new URL(url).host, 'yxsegwkzyiscrxiwdeuf.supabase.co', 'Runtime verification must target DEV')
assert.equal(process.env.IYZICO_BILLING_BASE_URL, 'https://sandbox-api.iyzipay.com', 'Runtime verification must use iyzico sandbox config')

const options = { auth: { autoRefreshToken: false, persistSession: false } } as const
const admin = createClient(url, serviceRoleKey, options)
type Rpc = (name: string, args: Record<string, unknown>) => Promise<{
  data: unknown; error: { code?: string; message: string } | null
}>
const rpc = admin.rpc.bind(admin) as unknown as Rpc
const refunds = createPlatformSubscriptionRefundPort(rpc)
const settings = createSubscriptionBillingSettingsReadPort(rpc as never)
const marker = `subscription-refund-${Date.now()}-${randomUUID().slice(0, 8)}`
const restaurantIds: string[] = []

function fingerprint(...parts: string[]) {
  return createHash('sha256').update(parts.join('\n')).digest('hex')
}

async function cleanupRestaurant(restaurantId: string) {
  const outbox = await admin.from('domain_outbox').select('id').eq('restaurant_id', restaurantId)
  assert.ifError(outbox.error)
  const outboxIds = (outbox.data ?? []).map((row) => row.id)
  if (outboxIds.length) assert.ifError((await admin.from('domain_outbox_receipts').delete().in('outbox_id', outboxIds)).error)
  for (const table of [
    'notification_deliveries', 'notification_inbox', 'domain_outbox',
    'accounting_review_jobs', 'accounting_invoice_jobs',
    'subscription_cancellation_provider_targets', 'subscription_cancellation_requests',
    'subscription_refunds',
    'billing_reconciliation_jobs', 'billing_provider_operations', 'billing_provider_events',
    'billing_subscription_provider_refs',
    'subscription_payment_attempts', 'subscription_invoices', 'billing_subscriptions', 'billing_customers',
  ]) assert.ifError((await admin.from(table).delete().eq('restaurant_id', restaurantId)).error)
  assert.ifError((await admin.from('restaurants').delete().eq('id', restaurantId)).error)
}

async function cleanup() {
  const fixtures = await admin.from('restaurants').select('id').like('slug', 'subscription-refund-%')
  assert.ifError(fixtures.error)
  for (const fixture of fixtures.data ?? []) await cleanupRestaurant(fixture.id)
}

async function fixture(ownerId: string, suffix: string, amountMinor = 100_000) {
  const slug = `${marker}-${suffix}`
  const restaurant = await admin.from('restaurants').insert({
    owner_id: ownerId, name: slug, slug, plan: 'pro',
  }).select('id').single()
  assert.ifError(restaurant.error)
  restaurantIds.push(restaurant.data!.id)
  const customer = await admin.from('billing_customers').insert({
    restaurant_id: restaurant.data!.id, legal_name: slug,
    contact_email: `${slug}@example.invalid`, provider_customer_ref: `${slug}:customer`,
  }).select('id').single()
  assert.ifError(customer.error)
  const start = new Date(Date.now() - 60_000).toISOString()
  const end = new Date(Date.now() + 30 * 86_400_000).toISOString()
  const subscription = await admin.from('billing_subscriptions').insert({
    restaurant_id: restaurant.data!.id, billing_customer_id: customer.data!.id,
    provider: 'iyzico', provider_subscription_ref: `${slug}:subscription`,
    provider_plan_ref: `${slug}:plan`, plan: 'pro', billing_interval: 'monthly',
    status: 'active', current_period_start: start, current_period_end: end,
  }).select('id').single()
  assert.ifError(subscription.error)
  const invoice = await admin.from('subscription_invoices').insert({
    restaurant_id: restaurant.data!.id, subscription_id: subscription.data!.id,
    provider: 'iyzico', provider_invoice_ref: `${slug}:order`,
    idempotency_key: `${slug}:invoice`, plan: 'pro', billing_interval: 'monthly',
    amount_due_minor: amountMinor, amount_paid_minor: amountMinor, currency: 'TRY',
    status: 'paid', period_start: start, period_end: end, due_at: start,
    finalized_at: start, paid_at: start,
  }).select('id').single()
  assert.ifError(invoice.error)
  const attempt = await admin.from('subscription_payment_attempts').insert({
    restaurant_id: restaurant.data!.id, invoice_id: invoice.data!.id,
    provider: 'iyzico', provider_attempt_ref: `${slug}:order`,
    provider_payment_id: `${slug}:payment`, idempotency_key: `${slug}:attempt`,
    attempt_number: 1, currency: 'TRY', amount_minor: amountMinor,
    status: 'succeeded', attempted_at: start, completed_at: start,
  }).select('id').single()
  assert.ifError(attempt.error)
  return {
    restaurantId: restaurant.data!.id, subscriptionId: subscription.data!.id,
    invoiceId: invoice.data!.id, paymentId: `${slug}:payment`, amountMinor,
  }
}

async function prepare(identity: { user_id: string; role: string }, value: Awaited<ReturnType<typeof fixture>>, input: {
  key: string; amountMinor: number; kind?: 'refund' | 'same_day_cancel'; reason?: string
  accessAction?: 'keep' | 'cancel_immediately'
}) {
  const requestId = randomUUID()
  const idempotencyKey = `${marker}:${input.key}`
  return refunds.prepare({
    restaurantId: value.restaurantId, invoiceId: value.invoiceId,
    actorUserId: identity.user_id, actorRole: identity.role as 'finance' | 'superadmin',
    kind: input.kind ?? 'refund',
    accessAction: input.kind === 'same_day_cancel' ? 'cancel_immediately' : input.accessAction ?? 'keep',
    amountMinor: input.amountMinor,
    reasonCode: 'customer_request', reasonDetail: input.reason ?? 'Runtime tarafından doğrulanan iade talebi',
    requestId, idempotencyKey,
    requestFingerprint: fingerprint(value.restaurantId, value.invoiceId, input.kind ?? 'refund',
      input.kind === 'same_day_cancel' ? 'cancel_immediately' : input.accessAction ?? 'keep',
      String(input.amountMinor), requestId),
    occurredAt: new Date().toISOString(),
  })
}

async function main() {
  await cleanup()
  const [owner, identity] = await Promise.all([
    admin.from('restaurants').select('owner_id').eq('slug', 'test-cafe-b').single(),
    admin.from('platform_admin_users').select('user_id,role,status')
      .in('role', ['finance', 'superadmin']).eq('status', 'active').limit(1).single(),
  ])
  assert.ifError(owner.error)
  assert.ifError(identity.error)

  const partial = await fixture(owner.data!.owner_id, 'partial')
  const requestId = randomUUID()
  const idempotencyKey = `${marker}:partial-1`
  const requestFingerprint = fingerprint(partial.restaurantId, partial.invoiceId, 'partial-1', requestId)
  const preparationInput = {
    restaurantId: partial.restaurantId, invoiceId: partial.invoiceId,
    actorUserId: identity.data!.user_id, actorRole: identity.data!.role as 'finance' | 'superadmin',
    kind: 'refund' as const, accessAction: 'keep' as const,
    amountMinor: 25_000, reasonCode: 'customer_request' as const,
    reasonDetail: 'Runtime tarafından doğrulanan kısmi iade talebi', requestId,
    idempotencyKey, requestFingerprint, occurredAt: new Date().toISOString(),
  }
  const prepared = await refunds.prepare(preparationInput)
  assert.ok(prepared.ok)
  assert.equal(prepared.value.scope, 'partial')
  assert.equal(prepared.value.providerPaymentId, partial.paymentId)
  const replay = await refunds.prepare(preparationInput)
  assert.ok(replay.ok)
  assert.equal(replay.value.duplicate, true)
  assert.equal(replay.value.dispatchable, false)
  assert.equal((await admin.from('subscription_refunds').select('id', { count: 'exact', head: true })
    .eq('restaurant_id', partial.restaurantId)).count, 1)
  assert.equal((await admin.from('domain_outbox').select('id', { count: 'exact', head: true })
    .eq('restaurant_id', partial.restaurantId).eq('event_type', 'refund.requested')).count, 1)
  console.log('A ✅ partial request and replay reserved one provider operation, audit and notification')

  const overCap = await prepare(identity.data!, partial, { key: 'over-cap', amountMinor: 80_000 })
  assert.equal(overCap.ok, false)
  assert.match(overCap.ok ? '' : overCap.error, /subscription_refund_amount_exceeds_available/)
  const completed = await refunds.complete({
    refundId: prepared.value.refundId, operationId: prepared.value.operationId,
    providerPaymentId: partial.paymentId, providerRefundRef: `${marker}:refund-host-1`,
    amountMinor: 25_000, occurredAt: new Date().toISOString(),
  })
  assert.ok(completed.ok)
  const completedReplay = await refunds.complete({
    refundId: prepared.value.refundId, operationId: prepared.value.operationId,
    providerPaymentId: partial.paymentId, providerRefundRef: `${marker}:refund-host-1`,
    amountMinor: 25_000, occurredAt: new Date().toISOString(),
  })
  assert.ok(completedReplay.ok)
  assert.equal(completedReplay.value.duplicate, true)
  assert.equal((await admin.from('accounting_review_jobs').select('id', { count: 'exact', head: true })
    .eq('source_key', `subscription-refund:${prepared.value.refundId}`)).count, 1)
  assert.equal((await admin.from('domain_outbox').select('id', { count: 'exact', head: true })
    .eq('restaurant_id', partial.restaurantId).eq('event_type', 'refund.succeeded')).count, 1)
  const unchanged = await admin.from('billing_subscriptions').select('status,plan').eq('id', partial.subscriptionId).single()
  assert.ifError(unchanged.error)
  assert.deepEqual(unchanged.data, { status: 'active', plan: 'pro' })
  const ownerProjection = await settings.readSettings({ restaurantId: partial.restaurantId })
  assert.ok(ownerProjection.ok)
  assert.equal(ownerProjection.value.refunds[0]?.status, 'succeeded')
  assert.equal(ownerProjection.value.refunds[0]?.amountMinor, 25_000)
  console.log('B ✅ verified completion/replay wrote one accounting review while entitlement stayed active')

  const rejectedFixture = await fixture(owner.data!.owner_id, 'rejected')
  const rejected = await prepare(identity.data!, rejectedFixture, { key: 'rejected-1', amountMinor: 10_000 })
  assert.ok(rejected.ok)
  const failed = await refunds.fail({
    refundId: rejected.value.refundId, operationId: rejected.value.operationId,
    failureCode: 'provider_rejected', requiresReconciliation: false,
    occurredAt: new Date().toISOString(),
  })
  assert.ok(failed.ok)
  const replacement = await prepare(identity.data!, rejectedFixture, { key: 'replacement-full', amountMinor: 100_000 })
  assert.ok(replacement.ok)
  assert.equal(replacement.value.scope, 'full')
  const lateSuccess = await refunds.complete({
    refundId: rejected.value.refundId, operationId: rejected.value.operationId,
    providerPaymentId: rejectedFixture.paymentId, providerRefundRef: `${marker}:late`,
    amountMinor: 10_000, occurredAt: new Date().toISOString(),
  })
  assert.equal(lateSuccess.ok, false)
  console.log('C ✅ definitive rejection released the cap and late out-of-order success was rejected')

  const uncertainFixture = await fixture(owner.data!.owner_id, 'uncertain')
  const uncertain = await prepare(identity.data!, uncertainFixture, { key: 'uncertain-1', amountMinor: 60_000 })
  assert.ok(uncertain.ok)
  const quarantined = await refunds.fail({
    refundId: uncertain.value.refundId, operationId: uncertain.value.operationId,
    failureCode: 'provider_timeout', requiresReconciliation: true,
    occurredAt: new Date().toISOString(),
  })
  assert.ok(quarantined.ok)
  assert.equal(quarantined.value.status, 'requires_reconciliation')
  const blocked = await prepare(identity.data!, uncertainFixture, { key: 'uncertain-over-cap', amountMinor: 50_000 })
  assert.equal(blocked.ok, false)
  assert.equal((await admin.from('billing_reconciliation_jobs').select('id', { count: 'exact', head: true })
    .eq('dedupe_key', `subscription-refund:${uncertain.value.refundId}`)).count, 1)
  console.log('D ✅ timeout quarantined without redispatch and its reserved amount remained in the cap')

  const sameDayFixture = await fixture(owner.data!.owner_id, 'same-day')
  const sameDay = await prepare(identity.data!, sameDayFixture, {
    key: 'same-day-full', amountMinor: sameDayFixture.amountMinor, kind: 'same_day_cancel',
  })
  assert.ok(sameDay.ok)
  assert.equal(sameDay.value.scope, 'full')
  const sameDayPartial = await fixture(owner.data!.owner_id, 'same-day-partial')
  const invalidSameDay = await prepare(identity.data!, sameDayPartial, {
    key: 'same-day-partial', amountMinor: 50_000, kind: 'same_day_cancel',
  })
  assert.equal(invalidSameDay.ok, false)
  console.log('E ✅ same-day cancellation accepted only a same-day full amount')
}

async function run() {
  try { await main() } finally {
    for (const restaurantId of restaurantIds.reverse()) await cleanupRestaurant(restaurantId)
    console.log('F ✅ isolated DEV fixtures removed; immutable platform audit evidence retained')
  }
}

void run().catch((error: unknown) => { console.error(error); process.exitCode = 1 })
