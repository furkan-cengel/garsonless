import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import {
  intervenePlatformBillingDunning,
  type PlatformDunningInterventionPort,
} from '@garsonless/application/platform-admin-billing'
import type { PlatformAdminActorContext } from '@garsonless/domain/platform-admin'
import { createServiceClient } from '../src/client'
import { createPlatformAdminDunningInterventionPort } from '../src/platform-admin-billing-port'
import type { Database } from '../src/types.gen'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function env(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing environment variable: ${name}`)
  return value
}

type RawRpc = (
  name: 'intervene_platform_admin_billing_dunning' | 'fail_billing_dunning',
  args: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>

const service = createServiceClient()
const suffix = randomUUID().slice(0, 8)
let restaurantId = ''
let invoiceId = ''

async function main() {
  let primaryError: unknown = null
  let immutableAuditRows = 0
  try {
    const [{ data: fixture, error: fixtureError }, { data: identity, error: identityError }] = await Promise.all([
      service.from('restaurants').select('id, owner_id').eq('slug', 'test-cafe-b').single(),
      service.from('platform_admin_users').select('user_id, role, status').eq('role', 'superadmin').eq('status', 'active').limit(1).single(),
    ])
    if (fixtureError || !fixture?.owner_id) throw fixtureError ?? new Error('Test Cafe B fixture unavailable')
    if (identityError || !identity) throw identityError ?? new Error('Active superadmin unavailable')

    const actor: PlatformAdminActorContext = {
      actor: 'platform-admin', userId: identity.user_id, role: 'superadmin', aal: 'aal2',
    }
    const { data: restaurant, error: restaurantError } = await service.from('restaurants').insert({
      owner_id: fixture.owner_id,
      slug: `platform-dunning-${suffix}`,
      name: `Platform dunning ${suffix}`,
      plan: 'pro',
    }).select('id').single()
    if (restaurantError || !restaurant) throw restaurantError ?? new Error('Throwaway tenant unavailable')
    restaurantId = restaurant.id

    const { data: customer, error: customerError } = await service.from('billing_customers').insert({
      restaurant_id: restaurantId,
      legal_name: `Platform dunning ${suffix}`,
      contact_email: `platform-dunning-${suffix}@example.invalid`,
    }).select('id').single()
    if (customerError || !customer) throw customerError ?? new Error('Billing customer unavailable')

    const periodStart = new Date(Date.now() - 86_400_000).toISOString()
    const periodEnd = new Date(Date.now() + 29 * 86_400_000).toISOString()
    const { data: subscription, error: subscriptionError } = await service.from('billing_subscriptions').insert({
      restaurant_id: restaurantId,
      billing_customer_id: customer.id,
      plan: 'pro',
      status: 'past_due',
      current_period_start: periodStart,
      current_period_end: periodEnd,
    }).select('id').single()
    if (subscriptionError || !subscription) throw subscriptionError ?? new Error('Subscription unavailable')

    const { data: invoice, error: invoiceError } = await service.from('subscription_invoices').insert({
      restaurant_id: restaurantId,
      subscription_id: subscription.id,
      idempotency_key: `platform-dunning-${suffix}`,
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
    invoiceId = invoice.id

    const initialNextActionAt = new Date(Date.now() + 86_400_000).toISOString()
    const { data: run, error: runError } = await service.from('dunning_runs').insert({
      restaurant_id: restaurantId,
      subscription_id: subscription.id,
      invoice_id: invoiceId,
      policy_snapshot: {
        secondWarningAfterDays: 3,
        finalWarningAfterDays: 7,
        suspendAfterDays: 14,
      },
      status: 'failed',
      current_step: 'retry',
      next_action_at: initialNextActionAt,
      last_error: 'runtime-sentinel-not-projected',
    }).select('id').single()
    if (runError || !run) throw runError ?? new Error('Dunning run unavailable')

    let deniedPortCalls = 0
    const deniedPort: PlatformDunningInterventionPort = {
      async intervene() {
        deniedPortCalls += 1
        throw new Error('Denied actor reached persistence')
      },
    }
    const denied = await intervenePlatformBillingDunning({ ...actor, role: 'ops' }, {
      restaurantId, invoiceId, intervention: 'retry_now',
      reason: 'Ops rolü ödeme takibine müdahale edemez', requestId: randomUUID(),
    }, deniedPort)
    assert(!denied.ok && denied.error === 'Not authorized' && deniedPortCalls === 0, 'Ops reached dunning persistence')

    const rawRpc = service.rpc.bind(service) as unknown as RawRpc
    const forged = await rawRpc('intervene_platform_admin_billing_dunning', {
      p_restaurant_id: restaurantId,
      p_invoice_id: invoiceId,
      p_actor_user_id: actor.userId,
      p_actor_role: 'finance',
      p_intervention: 'retry_now',
      p_defer_days: null,
      p_reason: 'Forged finance role must be rejected by database',
      p_request_id: randomUUID(),
    })
    assert(forged.error?.code === '42501', 'Database accepted a forged platform role')

    const anon = createClient<Database>(env('NEXT_PUBLIC_SUPABASE_URL'), env('NEXT_PUBLIC_SUPABASE_ANON_KEY'), {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const anonRpc = anon.rpc.bind(anon) as unknown as RawRpc
    const anonResult = await anonRpc('intervene_platform_admin_billing_dunning', {
      p_restaurant_id: restaurantId,
      p_invoice_id: invoiceId,
      p_actor_user_id: actor.userId,
      p_actor_role: actor.role,
      p_intervention: 'retry_now',
      p_defer_days: null,
      p_reason: 'Anonymous caller must be rejected by database',
      p_request_id: randomUUID(),
    })
    assert(anonResult.error?.code === '42501', 'Anonymous caller reached dunning mutation')

    const port = createPlatformAdminDunningInterventionPort()
    const retryRequestId = randomUUID()
    const retry = await intervenePlatformBillingDunning(actor, {
      restaurantId, invoiceId, intervention: 'retry_now',
      reason: 'Müşteri talebi sonrası tahsilat tekrar sıraya alındı', requestId: retryRequestId,
    }, port)
    assert(retry.ok && retry.value.changed && retry.value.previousStatus === 'failed' && retry.value.status === 'scheduled', 'Retry-now intervention failed')
    assert(Date.parse(retry.value.nextActionAt) <= Date.now() + 5_000, 'Retry-now did not make the run due')

    const replay = await intervenePlatformBillingDunning(actor, {
      restaurantId, invoiceId, intervention: 'retry_now',
      reason: 'Müşteri talebi sonrası tahsilat tekrar sıraya alındı', requestId: retryRequestId,
    }, port)
    assert(replay.ok && replay.value.duplicate, 'Retry replay was not idempotent')

    const { count: replayAuditRows, error: replayAuditError } = await service.from('platform_admin_audit_log')
      .select('id', { count: 'exact', head: true })
      .eq('actor_user_id', actor.userId)
      .eq('request_id', retryRequestId)
      .eq('target_id', invoiceId)
    if (replayAuditError) throw replayAuditError
    assert(replayAuditRows === 1, 'Retry replay wrote duplicate audit rows')

    const worker = `platform-dunning-runtime-${suffix}`
    const { error: leaseError } = await service.from('dunning_runs').update({
      status: 'running',
      locked_at: new Date().toISOString(),
      locked_by: worker,
    }).eq('id', run.id)
    if (leaseError) throw leaseError

    const busyRequestId = randomUUID()
    const busy = await intervenePlatformBillingDunning(actor, {
      restaurantId, invoiceId, intervention: 'defer', deferDays: 7,
      reason: 'Worker yarışı sırasında erteleme reddedilmelidir', requestId: busyRequestId,
    }, port)
    assert(!busy.ok && busy.error === 'Dunning run is currently being processed', 'Active worker lease was overwritten')
    const { count: busyAuditRows } = await service.from('platform_admin_audit_log').select('id', { count: 'exact', head: true }).eq('request_id', busyRequestId)
    assert(busyAuditRows === 0, 'Rejected busy intervention wrote an audit mutation')

    const failed = await rawRpc('fail_billing_dunning', {
      p_run_id: run.id, p_worker: worker, p_reason: 'runtime release', p_retry_delay_seconds: 60,
    })
    if (failed.error || failed.data !== true) throw failed.error ?? new Error('Worker lease release failed')

    const deferRequestId = randomUUID()
    const deferStartedAt = Date.now()
    const deferred = await intervenePlatformBillingDunning(actor, {
      restaurantId, invoiceId, intervention: 'defer', deferDays: 7,
      reason: 'Müşteriye yedi günlük kontrollü ek süre verildi', requestId: deferRequestId,
    }, port)
    assert(deferred.ok && deferred.value.status === 'scheduled', 'Defer intervention failed')
    assert(Date.parse(deferred.value.nextActionAt) >= deferStartedAt + 7 * 86_400_000 - 5_000, 'Defer period was shortened')

    const crossTenantRequestId = randomUUID()
    const crossTenant = await intervenePlatformBillingDunning(actor, {
      restaurantId: fixture.id, invoiceId, intervention: 'retry_now',
      reason: 'Cross tenant replay must not mutate dunning state', requestId: crossTenantRequestId,
    }, port)
    assert(!crossTenant.ok && crossTenant.error === 'Dunning intervention could not be applied', 'Cross-tenant invoice mutation succeeded')
    const { count: crossTenantAuditRows } = await service.from('platform_admin_audit_log').select('id', { count: 'exact', head: true }).eq('request_id', crossTenantRequestId)
    assert(crossTenantAuditRows === 0, 'Rejected cross-tenant intervention wrote audit')

    const { error: stopError } = await service.from('dunning_runs').update({ status: 'stopped', next_action_at: null }).eq('id', run.id)
    if (stopError) throw stopError
    const stoppedRequestId = randomUUID()
    const stopped = await intervenePlatformBillingDunning(actor, {
      restaurantId, invoiceId, intervention: 'retry_now',
      reason: 'Tamamlanmış takip yeniden açılamaz', requestId: stoppedRequestId,
    }, port)
    assert(!stopped.ok && stopped.error === 'Dunning run is not actionable', 'Stopped dunning run was reopened')

    const [{ data: invoiceAfter, error: invoiceAfterError }, { data: subscriptionAfter, error: subscriptionAfterError }, { count: providerOperations, error: providerOperationsError }] = await Promise.all([
      service.from('subscription_invoices').select('status, amount_paid_minor').eq('id', invoiceId).single(),
      service.from('billing_subscriptions').select('status').eq('id', subscription.id).single(),
      service.from('billing_provider_operations').select('id', { count: 'exact', head: true }).eq('restaurant_id', restaurantId),
    ])
    if (invoiceAfterError || !invoiceAfter) throw invoiceAfterError ?? new Error('Invoice state unavailable')
    if (subscriptionAfterError || !subscriptionAfter) throw subscriptionAfterError ?? new Error('Subscription state unavailable')
    if (providerOperationsError) throw providerOperationsError
    assert(invoiceAfter.status === 'past_due' && invoiceAfter.amount_paid_minor === 0, 'Intervention invented payment success')
    assert(subscriptionAfter.status === 'past_due', 'Intervention changed subscription authority')
    assert(providerOperations === 0, 'Intervention dispatched or claimed a provider operation')

    const { count: auditRows, error: auditError } = await service.from('platform_admin_audit_log')
      .select('id', { count: 'exact', head: true })
      .eq('target_type', 'billing_invoice')
      .eq('target_id', invoiceId)
    if (auditError) throw auditError
    immutableAuditRows = auditRows ?? -1
    assert(immutableAuditRows === 2, 'Unexpected immutable intervention audit count')

    console.log(JSON.stringify({
      project: new URL(env('NEXT_PUBLIC_SUPABASE_URL')).hostname,
      authorization: { denied, persistenceCalls: deniedPortCalls, forgedRoleCode: forged.error?.code, anonRpcCode: anonResult.error?.code },
      retry: { changed: retry.ok && retry.value.changed, replayDuplicate: replay.ok && replay.value.duplicate, auditRows: replayAuditRows, workerLeaseSimulated: true },
      race: { busy, rejectedAuditRows: busyAuditRows },
      defer: deferred,
      isolation: { crossTenant, rejectedAuditRows: crossTenantAuditRows, stopped },
      paymentAuthority: { invoice: invoiceAfter, subscription: subscriptionAfter, providerOperations },
      immutableAuditEvidence: immutableAuditRows,
    }, null, 2))
  } catch (error) {
    primaryError = error
  }

  if (restaurantId) {
    for (const table of ['dunning_runs', 'subscription_invoices', 'billing_subscriptions', 'billing_customers'] as const) {
      const { error } = await service.from(table).delete().eq('restaurant_id', restaurantId)
      if (error) throw error
    }
    const { error } = await service.from('restaurants').delete().eq('id', restaurantId)
    if (error) throw error
  }

  const marker = restaurantId || randomUUID()
  const tables = ['dunning_runs', 'subscription_invoices', 'billing_subscriptions', 'billing_customers'] as const
  const cleanup: Record<string, number> = {}
  for (const table of tables) {
    const { count, error } = await service.from(table).select('id', { count: 'exact', head: true }).eq('restaurant_id', marker)
    if (error) throw error
    cleanup[table] = count ?? -1
    assert(count === 0, `${table} cleanup left mutable rows`)
  }
  const { count: restaurants, error: restaurantCountError } = await service.from('restaurants').select('id', { count: 'exact', head: true }).eq('id', marker)
  if (restaurantCountError) throw restaurantCountError
  cleanup.restaurants = restaurants ?? -1
  assert(restaurants === 0, 'Restaurant cleanup left mutable rows')
  console.log(JSON.stringify({ cleanup, immutableAuditEvidence: immutableAuditRows }))
  if (primaryError) throw primaryError
}

void main()
