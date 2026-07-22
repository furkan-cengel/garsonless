import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../src/types.gen'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

assert(url, 'NEXT_PUBLIC_SUPABASE_URL is required')
assert(anonKey, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required')
assert(serviceRoleKey, 'SUPABASE_SERVICE_ROLE_KEY is required')

const options = { auth: { autoRefreshToken: false, persistSession: false } } as const
const admin = createClient<Database>(url, serviceRoleKey, options)
const anon = createClient<Database>(url, anonKey, options)

const billingTables = [
  'billing_platform_policies',
  'billing_customers',
  'billing_subscriptions',
  'subscription_invoices',
  'subscription_payment_attempts',
  'billing_provider_events',
  'billing_reconciliation_jobs',
  'dunning_runs',
  'tenant_lifecycle_events',
] as const

const marker = `billing-verify-${Date.now()}-${randomUUID().slice(0, 8)}`
const restaurantIds: string[] = []

async function authenticatedClient(userId: string): Promise<SupabaseClient<Database>> {
  const { data: userData, error: userError } = await admin.auth.admin.getUserById(userId)
  assert.ifError(userError)
  assert(userData.user?.email, 'Fixture owner must have an email')

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: userData.user.email,
  })
  assert.ifError(linkError)

  const client = createClient<Database>(url!, anonKey!, options)
  const { data: verified, error: verifyError } = await client.auth.verifyOtp({
    type: 'magiclink',
    token_hash: link.properties.hashed_token,
  })
  assert.ifError(verifyError)
  assert(verified.session, 'Expected a real authenticated session')
  return client
}

function expectDatabaseError(error: { code?: string } | null, expectedCode: string, label: string) {
  assert(error, `${label} unexpectedly succeeded`)
  assert.equal(error.code, expectedCode, `${label} must fail with ${expectedCode}`)
}

async function assertBillingReadsDenied(client: SupabaseClient<Database>, role: 'anon' | 'authenticated') {
  for (const table of billingTables) {
    const { error } = await client.from(table).select('*').limit(1)
    expectDatabaseError(error, '42501', `${role} read on ${table}`)
  }
}

async function cleanup() {
  for (const restaurantId of restaurantIds) {
    await admin.from('dunning_runs').delete().eq('restaurant_id', restaurantId)
    await admin.from('billing_reconciliation_jobs').delete().eq('restaurant_id', restaurantId)
    await admin.from('billing_provider_events').delete().eq('restaurant_id', restaurantId)
    await admin.from('subscription_payment_attempts').delete().eq('restaurant_id', restaurantId)
    await admin.from('subscription_invoices').delete().eq('restaurant_id', restaurantId)
    await admin.from('billing_subscriptions').delete().eq('restaurant_id', restaurantId)
    await admin.from('billing_customers').delete().eq('restaurant_id', restaurantId)
    await admin.from('restaurants').delete().eq('id', restaurantId)
  }
}

async function assertCleanup() {
  const counts: Record<string, number> = {}
  for (const table of billingTables.filter((table) => table !== 'billing_platform_policies')) {
    const { count, error } = await admin
      .from(table)
      .select('id', { count: 'exact', head: true })
      .in('restaurant_id', restaurantIds)
    assert.ifError(error)
    counts[table] = count ?? -1
    assert.equal(count, 0, `${table} cleanup left orphans`)
  }
  const { count: restaurantCount, error } = await admin
    .from('restaurants')
    .select('id', { count: 'exact', head: true })
    .in('id', restaurantIds)
  assert.ifError(error)
  counts.restaurants = restaurantCount ?? -1
  assert.equal(restaurantCount, 0, 'Temporary restaurants were not removed')
  console.log('F ✅ cleanup', counts)
}

async function main() {
  const { data: fixture, error: fixtureError } = await admin
    .from('restaurants')
    .select('owner_id')
    .eq('slug', 'test-cafe-b')
    .is('deleted_at', null)
    .single()
  assert.ifError(fixtureError)
  assert(fixture, 'Test Cafe B fixture was not found')

  const authenticated = await authenticatedClient(fixture.owner_id)

  const { data: policy, error: policyError } = await admin
    .from('billing_platform_policies')
    .select('trial_days, retry_after_days, second_warning_after_days, final_warning_after_days, suspend_after_days')
    .eq('id', 'default')
    .single()
  assert.ifError(policyError)
  assert.deepEqual(policy, {
    trial_days: 14,
    retry_after_days: 1,
    second_warning_after_days: 3,
    final_warning_after_days: 7,
    suspend_after_days: 14,
  })
  await assertBillingReadsDenied(anon, 'anon')
  await assertBillingReadsDenied(authenticated, 'authenticated')
  console.log('A ✅ service-role policy read; anon/authenticated 9/9 tables denied with 42501')

  const { data: restaurants, error: restaurantsError } = await admin
    .from('restaurants')
    .insert([
      { name: `Billing Verify A ${marker}`, slug: `${marker}-a`, owner_id: fixture.owner_id },
      { name: `Billing Verify B ${marker}`, slug: `${marker}-b`, owner_id: fixture.owner_id },
    ])
    .select('id, slug')
  assert.ifError(restaurantsError)
  assert.equal(restaurants?.length, 2)
  const restaurantA = restaurants!.find((row) => row.slug.endsWith('-a'))!.id
  const restaurantB = restaurants!.find((row) => row.slug.endsWith('-b'))!.id
  restaurantIds.push(restaurantA, restaurantB)

  const { data: customers, error: customersError } = await admin
    .from('billing_customers')
    .insert([
      { restaurant_id: restaurantA, legal_name: `A ${marker}`, contact_email: `a-${marker}@example.invalid` },
      { restaurant_id: restaurantB, legal_name: `B ${marker}`, contact_email: `b-${marker}@example.invalid` },
    ])
    .select('id, restaurant_id')
  assert.ifError(customersError)
  const customerA = customers!.find((row) => row.restaurant_id === restaurantA)!.id

  const trialEndsAt = new Date(Date.now() + 14 * 86_400_000).toISOString()
  const { data: subscription, error: subscriptionError } = await admin
    .from('billing_subscriptions')
    .insert({
      restaurant_id: restaurantA,
      billing_customer_id: customerA,
      plan: 'pro',
      status: 'trial',
      trial_ends_at: trialEndsAt,
      provider_subscription_ref: `${marker}:subscription-a`,
    })
    .select('id')
    .single()
  assert.ifError(subscriptionError)

  const { error: crossTenantSubscription } = await admin.from('billing_subscriptions').insert({
    restaurant_id: restaurantB,
    billing_customer_id: customerA,
    plan: 'pro',
    status: 'trial',
  })
  expectDatabaseError(crossTenantSubscription, '23503', 'cross-tenant billing customer composition')

  const { error: secondLiveSubscription } = await admin.from('billing_subscriptions').insert({
    restaurant_id: restaurantA,
    billing_customer_id: customerA,
    plan: 'starter',
    status: 'active',
  })
  expectDatabaseError(secondLiveSubscription, '23505', 'second live subscription')
  console.log('B ✅ cross-tenant customer rejected (23503); second live subscription rejected (23505)')

  const periodStart = new Date().toISOString()
  const periodEnd = new Date(Date.now() + 30 * 86_400_000).toISOString()
  const invoiceInput = {
    restaurant_id: restaurantA,
    subscription_id: subscription!.id,
    idempotency_key: `${marker}:invoice-1`,
    plan: 'pro',
    amount_due_minor: 14_990,
    status: 'open',
    period_start: periodStart,
    period_end: periodEnd,
    due_at: periodStart,
  }
  const { data: invoice, error: invoiceError } = await admin
    .from('subscription_invoices')
    .insert(invoiceInput)
    .select('id, amount_due_minor, currency')
    .single()
  assert.ifError(invoiceError)
  assert.deepEqual({ amount: invoice!.amount_due_minor, currency: invoice!.currency }, { amount: 14_990, currency: 'TRY' })

  const { error: invoiceReplay } = await admin.from('subscription_invoices').insert(invoiceInput)
  expectDatabaseError(invoiceReplay, '23505', 'invoice idempotency replay')
  const crossTenantPeriodStart = new Date(Date.now() + 31 * 86_400_000).toISOString()
  const crossTenantPeriodEnd = new Date(Date.now() + 61 * 86_400_000).toISOString()
  const { error: crossTenantInvoice } = await admin.from('subscription_invoices').insert({
    ...invoiceInput,
    restaurant_id: restaurantB,
    idempotency_key: `${marker}:invoice-cross-tenant`,
    period_start: crossTenantPeriodStart,
    period_end: crossTenantPeriodEnd,
    due_at: crossTenantPeriodStart,
  })
  expectDatabaseError(crossTenantInvoice, '23503', 'cross-tenant invoice composition')
  console.log('C ✅ TRY minor amount persisted; invoice replay 23505; cross-tenant invoice 23503')

  const attemptInput = {
    restaurant_id: restaurantA,
    invoice_id: invoice!.id,
    idempotency_key: `${marker}:attempt-1`,
    attempt_number: 1,
    amount_minor: 14_990,
  }
  const { error: attemptError } = await admin.from('subscription_payment_attempts').insert(attemptInput)
  assert.ifError(attemptError)
  const { error: attemptReplay } = await admin.from('subscription_payment_attempts').insert(attemptInput)
  expectDatabaseError(attemptReplay, '23505', 'payment attempt replay')

  const eventInput = {
    provider_event_id: `${marker}:event-1`,
    event_type: 'invoice.payment_failed',
    restaurant_id: restaurantA,
    subscription_id: subscription!.id,
    payload_sanitized: { status: 'failure', code: 'fixture_declined' },
    payload_hash: `${marker}:sha256`,
  }
  const { error: eventError } = await admin.from('billing_provider_events').insert(eventInput)
  assert.ifError(eventError)
  const { error: eventReplay } = await admin.from('billing_provider_events').insert(eventInput)
  expectDatabaseError(eventReplay, '23505', 'provider event replay')
  console.log('D ✅ payment attempt and provider event retries remain single-row (23505)')

  const dunningInput = {
    restaurant_id: restaurantA,
    subscription_id: subscription!.id,
    invoice_id: invoice!.id,
    policy_snapshot: { retryAfterDays: 1, warningDays: [3, 7], suspendAfterDays: 14 },
    next_action_at: new Date(Date.now() + 86_400_000).toISOString(),
  }
  const { error: dunningError } = await admin.from('dunning_runs').insert(dunningInput)
  assert.ifError(dunningError)
  const { error: dunningReplay } = await admin.from('dunning_runs').insert(dunningInput)
  expectDatabaseError(dunningReplay, '23505', 'duplicate dunning coordinator')
  console.log('E ✅ one invoice → one dunning coordinator (retry rejected with 23505)')
}

async function run() {
  try {
    await main()
  } finally {
    await cleanup()
    await assertCleanup()
  }
}

void run().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
