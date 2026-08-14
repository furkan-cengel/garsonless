import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { readPlatformTenantBillingTimeline } from '@garsonless/application/platform-admin-billing'
import type { PlatformAdminActorContext } from '@garsonless/domain/platform-admin'
import { createServiceClient } from '../src/client'
import { createPlatformAdminTenantBillingReadPort } from '../src/platform-admin-billing-port'
import type { Database } from '../src/types.gen'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function env(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing environment variable: ${name}`)
  return value
}

type RawBillingTimelineRpc = (
  name: 'read_platform_admin_tenant_billing_timeline',
  args: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>

const service = createServiceClient()
const suffix = randomUUID().slice(0, 8)
const restaurantIds: string[] = []

async function cleanup() {
  if (restaurantIds.length === 0) return
  for (const table of [
    'billing_provider_operations',
    'dunning_runs',
    'billing_reconciliation_jobs',
    'billing_provider_events',
    'subscription_payment_attempts',
    'subscription_invoices',
    'billing_subscriptions',
    'billing_customers',
  ] as const) {
    const { error } = await service.from(table).delete().in('restaurant_id', restaurantIds)
    if (error) throw error
  }
  const { error } = await service.from('restaurants').delete().in('id', restaurantIds)
  if (error) throw error
}

async function assertCleanup() {
  if (restaurantIds.length === 0) return
  const tables = [
    'billing_provider_operations',
    'dunning_runs',
    'billing_reconciliation_jobs',
    'billing_provider_events',
    'subscription_payment_attempts',
    'subscription_invoices',
    'billing_subscriptions',
    'billing_customers',
  ] as const
  const counts: Record<string, number> = {}
  for (const table of tables) {
    const { count, error } = await service.from(table).select('id', { count: 'exact', head: true }).in('restaurant_id', restaurantIds)
    if (error) throw error
    counts[table] = count ?? -1
    assert(count === 0, `${table} cleanup left mutable rows`)
  }
  const { count, error } = await service.from('restaurants').select('id', { count: 'exact', head: true }).in('id', restaurantIds)
  if (error) throw error
  counts.restaurants = count ?? -1
  assert(count === 0, 'Restaurant cleanup left mutable rows')
  console.log(JSON.stringify({ cleanup: counts }))
}

async function main() {
  let primaryError: unknown = null
  try {
    const [{ data: fixture, error: fixtureError }, { data: identity, error: identityError }] = await Promise.all([
      service.from('restaurants').select('owner_id').eq('slug', 'test-cafe-b').single(),
      service.from('platform_admin_users').select('user_id, role, status').eq('role', 'superadmin').eq('status', 'active').limit(1).single(),
    ])
    if (fixtureError || !fixture?.owner_id) throw fixtureError ?? new Error('Test Cafe B fixture unavailable')
    if (identityError || !identity) throw identityError ?? new Error('Active superadmin unavailable')

    const actor: PlatformAdminActorContext = {
      actor: 'platform-admin',
      userId: identity.user_id,
      role: 'superadmin',
      aal: 'aal2',
    }
    const { data: restaurants, error: restaurantError } = await service.from('restaurants').insert([
      { owner_id: fixture.owner_id, slug: `platform-billing-${suffix}-a`, name: `Platform billing ${suffix} A`, plan: 'pro' },
      { owner_id: fixture.owner_id, slug: `platform-billing-${suffix}-b`, name: `Platform billing ${suffix} B`, plan: 'starter' },
    ]).select('id, slug')
    if (restaurantError || restaurants?.length !== 2) throw restaurantError ?? new Error('Throwaway tenants unavailable')
    const restaurantA = restaurants.find((row) => row.slug.endsWith('-a'))!.id
    const restaurantB = restaurants.find((row) => row.slug.endsWith('-b'))!.id
    restaurantIds.push(restaurantA, restaurantB)

    const secret = `must-not-leak-${suffix}`
    const { data: customer, error: customerError } = await service.from('billing_customers').insert({
      restaurant_id: restaurantA,
      legal_name: secret,
      contact_email: `${secret}@example.invalid`,
      provider_customer_ref: `${secret}-customer-ref`,
    }).select('id').single()
    if (customerError || !customer) throw customerError ?? new Error('Billing customer unavailable')

    const periodStart = new Date(Date.now() - 86_400_000).toISOString()
    const periodEnd = new Date(Date.now() + 29 * 86_400_000).toISOString()
    const { data: subscription, error: subscriptionError } = await service.from('billing_subscriptions').insert({
      restaurant_id: restaurantA,
      billing_customer_id: customer.id,
      provider_subscription_ref: `${secret}-subscription-ref`,
      plan: 'pro',
      status: 'past_due',
      current_period_start: periodStart,
      current_period_end: periodEnd,
    }).select('id').single()
    if (subscriptionError || !subscription) throw subscriptionError ?? new Error('Subscription unavailable')

    const { data: invoice, error: invoiceError } = await service.from('subscription_invoices').insert({
      restaurant_id: restaurantA,
      subscription_id: subscription.id,
      provider_invoice_ref: `${secret}-invoice-ref`,
      idempotency_key: `${secret}-invoice-key`,
      plan: 'pro',
      amount_due_minor: 14_990,
      amount_paid_minor: 0,
      status: 'past_due',
      period_start: periodStart,
      period_end: periodEnd,
      due_at: periodStart,
      finalized_at: periodStart,
      failed_at: new Date().toISOString(),
    }).select('id').single()
    if (invoiceError || !invoice) throw invoiceError ?? new Error('Invoice unavailable')

    const now = new Date().toISOString()
    const inserts = await Promise.all([
      service.from('subscription_payment_attempts').insert({
        restaurant_id: restaurantA,
        invoice_id: invoice.id,
        provider_attempt_ref: `${secret}-attempt-ref`,
        idempotency_key: `${secret}-attempt-key`,
        attempt_number: 1,
        amount_minor: 14_990,
        status: 'failed',
        failure_code: secret,
        failure_message: `${secret}-raw-failure`,
        completed_at: now,
      }),
      service.from('dunning_runs').insert({
        restaurant_id: restaurantA,
        subscription_id: subscription.id,
        invoice_id: invoice.id,
        policy_snapshot: { sentinel: secret },
        status: 'scheduled',
        current_step: 'retry',
        next_action_at: new Date(Date.now() + 86_400_000).toISOString(),
        attempts: 1,
        last_error: `${secret}-dunning-error`,
      }),
      service.from('billing_reconciliation_jobs').insert({
        restaurant_id: restaurantA,
        subscription_id: subscription.id,
        scope: 'invoice',
        dedupe_key: `${secret}-reconciliation-key`,
        status: 'discrepancy',
        attempts: 2,
        local_snapshot: { sentinel: secret },
        provider_snapshot_sanitized: { sentinel: secret },
        discrepancy_code: secret,
        last_error: `${secret}-reconciliation-error`,
      }),
      service.from('billing_provider_events').insert({
        restaurant_id: restaurantA,
        subscription_id: subscription.id,
        provider_event_id: `${secret}-event-ref`,
        event_type: 'invoice.payment_failed',
        payload_hash: `${secret}-payload-hash`,
        payload_sanitized: { sentinel: secret },
        status: 'failed',
        attempts: 2,
        last_error: `${secret}-provider-event-error`,
      }),
      service.from('billing_provider_operations').insert({
        restaurant_id: restaurantA,
        billing_customer_id: customer.id,
        subscription_id: subscription.id,
        invoice_id: invoice.id,
        operation_type: 'payment.retry',
        idempotency_key: `${secret}-operation-key`,
        request_fingerprint: 'a'.repeat(64),
        status: 'requires_reconciliation',
        amount_minor: 14_990,
        currency: 'TRY',
        provider_payment_ref: `${secret}-payment-ref`,
        result_sanitized: { sentinel: secret },
        attempts: 2,
        last_error: `${secret}-operation-error`,
      }),
    ])
    for (const result of inserts) if (result.error) throw result.error

    let deniedPortCalls = 0
    const denied = await readPlatformTenantBillingTimeline(
      { ...actor, role: 'support' },
      restaurantA,
      { async readTimeline() { deniedPortCalls += 1; throw new Error('denied role reached persistence') } },
    )
    assert(!denied.ok && denied.error === 'Not authorized' && deniedPortCalls === 0, 'Support reached billing persistence')

    const port = createPlatformAdminTenantBillingReadPort()
    const timeline = await readPlatformTenantBillingTimeline(actor, restaurantA, port, 50)
    assert(timeline.ok, 'Superadmin billing timeline failed')
    assert(timeline.value.summary.outstandingMinor === 14_990, 'Outstanding amount is incorrect')
    assert(timeline.value.summary.openInvoices === 1, 'Open invoice count is incorrect')
    assert(timeline.value.summary.activeDunning === 1, 'Active dunning count is incorrect')
    assert(timeline.value.summary.openReconciliation === 1, 'Open reconciliation count is incorrect')
    assert(timeline.value.summary.failedAttempts === 1, 'Failed attempt count is incorrect')
    assert(new Set(timeline.value.items.map((item) => item.kind)).size === 6, 'Timeline does not cover all six source kinds')
    const serialized = JSON.stringify(timeline.value)
    assert(!serialized.includes(secret), 'Safe timeline leaked PII/provider/raw diagnostics')

    const crossTenant = await readPlatformTenantBillingTimeline(actor, restaurantB, port, 50)
    assert(crossTenant.ok && crossTenant.value.items.length === 0 && crossTenant.value.summary.outstandingMinor === 0, 'Cross-tenant data leaked')

    const rawRpc = service.rpc.bind(service) as unknown as RawBillingTimelineRpc
    const forged = await rawRpc('read_platform_admin_tenant_billing_timeline', {
      p_restaurant_id: restaurantA,
      p_actor_user_id: actor.userId,
      p_actor_role: 'finance',
      p_limit: 50,
    })
    assert(forged.error?.code === '42501', 'Database accepted a forged finance role')
    const invalidLimit = await rawRpc('read_platform_admin_tenant_billing_timeline', {
      p_restaurant_id: restaurantA,
      p_actor_user_id: actor.userId,
      p_actor_role: actor.role,
      p_limit: 101,
    })
    assert(invalidLimit.error?.code === '22023', 'Database accepted an unbounded timeline read')

    const anon = createClient<Database>(env('NEXT_PUBLIC_SUPABASE_URL'), env('NEXT_PUBLIC_SUPABASE_ANON_KEY'), {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const anonRpc = anon.rpc.bind(anon) as unknown as RawBillingTimelineRpc
    const anonResult = await anonRpc('read_platform_admin_tenant_billing_timeline', {
      p_restaurant_id: restaurantA,
      p_actor_user_id: actor.userId,
      p_actor_role: actor.role,
      p_limit: 50,
    })
    assert(anonResult.error?.code === '42501', 'Anonymous caller reached billing timeline')

    console.log(JSON.stringify({
      project: new URL(env('NEXT_PUBLIC_SUPABASE_URL')).hostname,
      authorization: { support: denied, persistenceCalls: deniedPortCalls, forgedRoleCode: forged.error?.code, anonRpcCode: anonResult.error?.code },
      bounds: { invalidLimitCode: invalidLimit.error?.code },
      timeline: { summary: timeline.value.summary, itemKinds: timeline.value.items.map((item) => item.kind), safeProjection: !serialized.includes(secret) },
      tenantIsolation: { otherTenantItems: crossTenant.value.items.length, otherTenantOutstanding: crossTenant.value.summary.outstandingMinor },
    }, null, 2))
  } catch (error) {
    primaryError = error
  }

  await cleanup()
  await assertCleanup()
  if (primaryError) throw primaryError
}

void main()
