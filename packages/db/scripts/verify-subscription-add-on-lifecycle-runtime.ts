import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { resolveRestaurantFeatureEntitlement, type FeatureEntitlementRpc } from '../src/feature-entitlement-port'
import {
  createSubscriptionBillingOperationsPort,
  type SubscriptionBillingOperationsRpc,
} from '../src/subscription-billing-operations-port'
import {
  createSubscriptionBillingSettingsReadPort,
  type SubscriptionBillingSettingsRpc,
} from '../src/subscription-billing-settings-port'
import type { Database } from '../src/types.gen'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
assert(url && serviceRoleKey, 'DEV Supabase runtime environment is required')
assert.equal(new URL(url).host, 'yxsegwkzyiscrxiwdeuf.supabase.co', 'Runtime verification must target DEV')
assert.equal(
  process.env.IYZICO_BILLING_BASE_URL,
  'https://sandbox-api.iyzipay.com',
  'Runtime verification must use iyzico sandbox config',
)

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
const operations = createSubscriptionBillingOperationsPort(rpc as SubscriptionBillingOperationsRpc)
const settings = createSubscriptionBillingSettingsReadPort(rpc as SubscriptionBillingSettingsRpc)
const entitlementRpc = rpc as FeatureEntitlementRpc
const marker = `add-on-lifecycle-${Date.now()}-${randomUUID().slice(0, 8)}`
let restaurantId: string | null = null

function object(value: unknown): Record<string, unknown> {
  assert(value && typeof value === 'object' && !Array.isArray(value), 'Expected object result')
  return value as Record<string, unknown>
}

function required(name: string): string {
  const value = process.env[name]?.trim()
  assert(value, `${name} is required`)
  return value
}

function iso(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * 86_400_000).toISOString()
}

function monthBoundary(offsetMonths: number): string {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offsetMonths, 1)).toISOString()
}

function after(instant: string, offsetMilliseconds = 60_000): string {
  return new Date(Date.parse(instant) + offsetMilliseconds).toISOString()
}

async function cleanupRestaurant(fixtureRestaurantId: string) {
  const outbox = await admin.from('domain_outbox').select('id').eq('restaurant_id', fixtureRestaurantId)
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
    const deleted = await migrationAdmin.from(table).delete().eq('restaurant_id', fixtureRestaurantId)
    assert.ifError(deleted.error)
  }
  assert.ifError((await admin.from('restaurants').delete().eq('id', fixtureRestaurantId)).error)
}

async function cleanup() {
  const fixtures = await admin.from('restaurants').select('id').like('slug', 'add-on-lifecycle-%')
  assert.ifError(fixtures.error)
  for (const fixture of fixtures.data ?? []) await cleanupRestaurant(fixture.id)
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

async function hydrate(input: {
  worker: string
  customerRef: string
  subscriptionRef: string
  orderRef: string
  planRef: string
  addOns: string[]
  amountMinor: number
  periodStart: string
  periodEnd: string
  occurredAt: string
}) {
  const claimed = await rpc('claim_subscription_invoice_hydration', {
    p_worker: input.worker,
    p_limit: 1,
    p_lease_seconds: 60,
  })
  assert.ifError(claimed.error)
  const jobs = claimed.data as Array<Record<string, unknown>>
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0]?.providerSubscriptionRef, input.subscriptionRef)
  const result = await rpc('hydrate_subscription_invoice_with_payment_identity', {
    p_job_id: jobs[0]!.jobId,
    p_provider_event_id: jobs[0]!.providerEventId,
    p_worker: input.worker,
    p_provider_customer_ref: input.customerRef,
    p_provider_subscription_ref: input.subscriptionRef,
    p_provider_invoice_ref: input.orderRef,
    p_provider_plan_ref: input.planRef,
    p_plan: 'starter',
    p_add_ons: input.addOns,
    p_billing_interval: 'monthly',
    p_amount_minor: input.amountMinor,
    p_currency: 'TRY',
    p_period_start: input.periodStart,
    p_period_end: input.periodEnd,
    p_provider_order_status: 'succeeded',
    p_provider_payment_id: `${input.orderRef}:payment`,
    p_occurred_at: input.occurredAt,
  })
  assert.ifError(result.error)
  return object(result.data)
}

async function schedule(input: {
  ownerId: string
  targetPlanRef: string
  targetSubscriptionRef: string
  addOns: 'storefront_video_hero'[]
  id: string
  periodStart: string
  periodEnd: string
  parentRef: string
}) {
  assert(restaurantId)
  const fingerprint = createHash('sha256').update(`${marker}:${input.id}`).digest('hex')
  const prepared = await operations.preparePlanChange({
    restaurantId,
    toPlan: 'starter',
    toAddOns: input.addOns,
    toBillingInterval: 'monthly',
    providerTargetPlanRef: input.targetPlanRef,
    effectivePolicy: 'next_period',
    idempotencyKey: `${marker}:${input.id}`,
    requestFingerprint: fingerprint,
    requestedBy: input.ownerId,
  })
  assert.ok(prepared.ok)
  assert.equal(prepared.value.dispatchable, true)
  const finalized = await operations.finalizePlanChange({
    operationId: prepared.value.operationId,
    changeRequestId: prepared.value.changeRequestId,
    occurredAt: iso(0),
    result: {
      providerParentSubscriptionRef: input.parentRef,
      providerTargetSubscriptionRef: input.targetSubscriptionRef,
      providerTargetPlanRef: input.targetPlanRef,
      providerStatus: 'active',
      providerPeriodStart: input.periodStart,
      providerPeriodEnd: input.periodEnd,
    },
  })
  assert.ok(finalized.ok)
  return { changeRequestId: prepared.value.changeRequestId }
}

async function videoHeroAllowed(): Promise<boolean> {
  assert(restaurantId)
  const result = await resolveRestaurantFeatureEntitlement(
    {
      restaurantId,
      plan: 'starter',
      feature: 'theme_video_hero',
    },
    entitlementRpc,
  )
  assert.ok(result.ok)
  return result.value.allowed
}

async function readSettings() {
  assert(restaurantId)
  const result = await settings.readSettings({ restaurantId })
  assert.ok(result.ok)
  assert(result.value.subscription)
  return result.value
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
      plan: 'starter',
    })
    .select('id')
    .single()
  assert.ifError(restaurant.error)
  restaurantId = restaurant.data!.id

  const customerRef = `${marker}:customer`
  const parentRef = `${marker}:base-parent`
  const basePlanRef = required('IYZICO_BILLING_STARTER_MONTHLY_PLAN_REF')
  const firstStart = monthBoundary(0)
  const firstEnd = monthBoundary(1)
  const secondEnd = monthBoundary(2)
  const thirdEnd = monthBoundary(3)
  const catalog = await migrationAdmin
    .from('subscription_add_on_catalog')
    .select('provider_plan_ref,provider_gross_amount_minor')
    .eq('add_on', 'storefront_video_hero')
    .eq('plan', 'starter')
    .eq('billing_interval', 'monthly')
    .eq('active', true)
    .single()
  assert.ifError(catalog.error)
  const videoPlanRef = String(catalog.data!.provider_plan_ref)
  const videoAmount = Number(catalog.data!.provider_gross_amount_minor)
  const checkoutFingerprint = createHash('sha256').update(`${marker}:checkout:${videoPlanRef}`).digest('hex')
  const checkoutInput = {
    restaurantId,
    profile: {
      legalName: marker,
      taxOffice: 'Sandbox',
      name: 'Add-on',
      surname: 'Runtime',
      identityNumber: '11111111110',
      email: `${marker}@example.invalid`,
      gsmNumber: '+905550000000',
      billingAddress: {
        contactName: 'Add-on Runtime',
        city: 'Istanbul',
        district: 'Kartal',
        country: 'Türkiye',
        address: 'Sandbox test address',
        zipCode: '34860',
      },
      shippingAddress: {
        contactName: 'Add-on Runtime',
        city: 'Istanbul',
        district: 'Kartal',
        country: 'Türkiye',
        address: 'Sandbox test address',
        zipCode: '34860',
      },
    },
    plan: 'starter' as const,
    addOns: ['storefront_video_hero'] as const,
    interval: 'monthly' as const,
    amount: { minor: videoAmount, currency: 'TRY' as const },
    periodStart: firstStart,
    periodEnd: firstEnd,
    dueAt: iso(0),
    expectedProviderPlanRef: videoPlanRef,
    idempotencyKey: `${marker}:checkout`,
    requestFingerprint: checkoutFingerprint,
  }
  const preparedCheckout = await operations.prepareCheckout(checkoutInput)
  assert.ok(preparedCheckout.ok)
  assert.equal(preparedCheckout.value.dispatchable, true)
  assert.equal(preparedCheckout.value.duplicate, false)
  const bound = await operations.bindCheckoutProviderPlan({
    operationId: preparedCheckout.value.operationId,
    expectedProviderPlanRef: videoPlanRef,
  })
  assert.ok(bound.ok)
  const replayedCheckout = await operations.prepareCheckout(checkoutInput)
  assert.ok(replayedCheckout.ok)
  assert.equal(replayedCheckout.value.dispatchable, false)
  assert.equal(replayedCheckout.value.duplicate, true)
  const operation = await migrationAdmin
    .from('billing_provider_operations')
    .select('result_sanitized')
    .eq('id', preparedCheckout.value.operationId)
    .single()
  assert.ifError(operation.error)
  assert.equal(object(operation.data!.result_sanitized).expectedProviderPlanRef, videoPlanRef)
  console.log('A ✅ add-on checkout prepared, exact plan bound and replayed without provider dispatch')

  const customer = await admin
    .from('billing_customers')
    .update({ provider_customer_ref: customerRef })
    .eq('id', preparedCheckout.value.customerId)
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
      provider_plan_ref: basePlanRef,
      plan: 'starter',
      billing_interval: 'monthly',
      status: 'active',
      current_period_start: firstStart,
      current_period_end: firstEnd,
    })
    .select('id')
    .single()
  assert.ifError(subscription.error)

  const initial = await readSettings()
  assert.deepEqual(initial.subscription!.activeAddOns, [])
  assert.deepEqual(initial.subscription!.scheduledAddOns, [])
  assert.equal(await videoHeroAllowed(), false)
  console.log('B ✅ no-change owner projection stayed non-null and Starter denied Video Hero')

  const videoChildRef = `${marker}:video-child`
  const addChange = await schedule({
    ownerId: owner.data!.owner_id,
    targetPlanRef: videoPlanRef,
    targetSubscriptionRef: videoChildRef,
    addOns: ['storefront_video_hero'],
    id: 'add-video',
    periodStart: firstEnd,
    periodEnd: secondEnd,
    parentRef,
  })
  const scheduledAdd = await readSettings()
  assert.deepEqual(scheduledAdd.subscription!.activeAddOns, [])
  assert.deepEqual(scheduledAdd.subscription!.scheduledAddOns, ['storefront_video_hero'])
  assert.equal(await videoHeroAllowed(), false)
  console.log('C ✅ add-on scheduling projected the target but did not grant access before paid renewal')

  const addEventId = `${marker}:add-event`
  const addOrderRef = `${marker}:add-order`
  const addOccurredAt = after(firstEnd)
  await ingest({
    eventId: addEventId,
    customerRef,
    subscriptionRef: videoChildRef,
    orderRef: addOrderRef,
    occurredAt: addOccurredAt,
  })
  const paidAdd = await hydrate({
    worker: `${marker}:add-worker`,
    customerRef,
    subscriptionRef: videoChildRef,
    orderRef: addOrderRef,
    planRef: videoPlanRef,
    addOns: ['storefront_video_hero'],
    amountMinor: videoAmount,
    periodStart: firstEnd,
    periodEnd: secondEnd,
    occurredAt: addOccurredAt,
  })
  assert.equal(paidAdd.invoiceStatus, 'paid')
  assert.equal(
    (
      await migrationAdmin
        .from('subscription_change_requests')
        .select('status')
        .eq('id', addChange.changeRequestId)
        .single()
    ).data?.status,
    'applied',
  )
  const activeAdd = await readSettings()
  assert.deepEqual(activeAdd.subscription!.activeAddOns, ['storefront_video_hero'])
  assert.deepEqual(activeAdd.subscription!.scheduledAddOns, [])
  assert.equal(await videoHeroAllowed(), true)
  assert.deepEqual(activeAdd.invoices[0]?.addOns, ['storefront_video_hero'])
  console.log('D ✅ paid child renewal activated Video Hero and exposed invoice evidence atomically')

  const addReplay = await ingest({
    eventId: addEventId,
    customerRef,
    subscriptionRef: videoChildRef,
    orderRef: addOrderRef,
    occurredAt: addOccurredAt,
  })
  assert.equal(addReplay.alreadyProcessed, true)
  assert.equal(
    (
      await admin
        .from('subscription_invoices')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
    ).count,
    1,
  )
  assert.equal(
    (
      await admin
        .from('domain_outbox')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .eq('event_type', 'plan.changed')
    ).count,
    1,
  )
  console.log('E ✅ add-on payment webhook replay produced no duplicate invoice or change event')

  const baseChildRef = `${marker}:base-child`
  const removeChange = await schedule({
    ownerId: owner.data!.owner_id,
    targetPlanRef: basePlanRef,
    targetSubscriptionRef: baseChildRef,
    addOns: [],
    id: 'remove-video',
    periodStart: secondEnd,
    periodEnd: thirdEnd,
    parentRef: videoChildRef,
  })
  const scheduledRemove = await readSettings()
  assert.deepEqual(scheduledRemove.subscription!.activeAddOns, ['storefront_video_hero'])
  assert.deepEqual(scheduledRemove.subscription!.scheduledAddOns, [])
  assert.equal(await videoHeroAllowed(), true)
  console.log('F ✅ removal stayed scheduled while the already-paid add-on entitlement remained active')

  const removeEventId = `${marker}:remove-event`
  const removeOrderRef = `${marker}:remove-order`
  await ingest({
    eventId: removeEventId,
    customerRef,
    subscriptionRef: baseChildRef,
    orderRef: removeOrderRef,
    occurredAt: after(secondEnd),
  })
  const paidRemove = await hydrate({
    worker: `${marker}:remove-worker`,
    customerRef,
    subscriptionRef: baseChildRef,
    orderRef: removeOrderRef,
    planRef: basePlanRef,
    addOns: [],
    amountMinor: 41_880,
    periodStart: secondEnd,
    periodEnd: thirdEnd,
    occurredAt: after(secondEnd),
  })
  assert.equal(paidRemove.invoiceStatus, 'paid')
  assert.equal(
    (
      await migrationAdmin
        .from('subscription_change_requests')
        .select('status')
        .eq('id', removeChange.changeRequestId)
        .single()
    ).data?.status,
    'applied',
  )
  const removed = await readSettings()
  assert.deepEqual(removed.subscription!.activeAddOns, [])
  assert.deepEqual(removed.subscription!.scheduledAddOns, [])
  assert.equal(await videoHeroAllowed(), false)
  assert.deepEqual(
    removed.invoices.map((invoice) => invoice.addOns),
    [[], ['storefront_video_hero']],
  )
  assert.equal(
    (
      await admin
        .from('domain_outbox')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .eq('event_type', 'plan.changed')
    ).count,
    2,
  )
  console.log('G ✅ next paid base renewal removed Video Hero and disabled the feature once')

  const invalid = await operations.preparePlanChange({
    restaurantId,
    toPlan: 'pro',
    toAddOns: ['storefront_video_hero'],
    toBillingInterval: 'monthly',
    providerTargetPlanRef: `${marker}:invalid`,
    effectivePolicy: 'next_period',
    idempotencyKey: `${marker}:invalid`,
    requestFingerprint: createHash('sha256').update(`${marker}:invalid`).digest('hex'),
    requestedBy: owner.data!.owner_id,
  })
  assert.equal(invalid.ok, false)
  assert.match(invalid.ok ? '' : invalid.error, /billing_plan_change_input_invalid/)
  console.log('H ✅ incompatible Pro + Video Hero selection failed closed at the database boundary')
}

async function run() {
  try {
    await main()
  } finally {
    await cleanup()
    if (restaurantId) {
      assert.equal(
        (await admin.from('restaurants').select('id', { count: 'exact', head: true }).eq('id', restaurantId)).count,
        0,
      )
    }
    console.log('I ✅ add-on lifecycle DEV fixtures removed')
  }
}

void run().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
