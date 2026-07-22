import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { setPlatformTenantPlan } from '@garsonless/application/platform-admin-tenant-plans'
import type { PlatformAdminActorContext } from '@garsonless/domain/platform-admin'
import { createServiceClient } from '../src/client'
import { createPlatformAdminTenantPlanManagementPort } from '../src/platform-admin-tenant-plan-port'
import type { Database } from '../src/types.gen'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function env(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing environment variable: ${name}`)
  return value
}

type RawPlanRpc = (
  name: 'set_platform_admin_tenant_plan',
  args: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>

const service = createServiceClient()
const suffix = randomUUID().slice(0, 8)
let restaurantId = ''

async function main() {
  let primaryError: unknown = null
  let immutableAuditRows = 0

  try {
    const [{ data: fixture, error: fixtureError }, { data: identity, error: identityError }] = await Promise.all([
      service.from('restaurants').select('owner_id').eq('slug', 'test-cafe-b').single(),
      service.from('platform_admin_users')
        .select('user_id, role, status')
        .eq('role', 'superadmin')
        .eq('status', 'active')
        .limit(1)
        .single(),
    ])
    if (fixtureError || !fixture?.owner_id) throw fixtureError ?? new Error('Fixture owner unavailable')
    if (identityError || !identity) throw identityError ?? new Error('Active superadmin unavailable')

    const actor: PlatformAdminActorContext = {
      actor: 'platform-admin',
      userId: identity.user_id,
      role: 'superadmin',
      aal: 'aal2',
    }
    const port = createPlatformAdminTenantPlanManagementPort()

    const { data: restaurant, error: restaurantError } = await service
      .from('restaurants')
      .insert({
        owner_id: fixture.owner_id,
        slug: `platform-plan-${suffix}`,
        name: `Platform plan ${suffix}`,
        plan: 'free',
        settings: { runtimeVerification: true },
      })
      .select('id, plan')
      .single()
    if (restaurantError || !restaurant) throw restaurantError ?? new Error('Throwaway tenant unavailable')
    restaurantId = restaurant.id

    let deniedPortCalls = 0
    const deniedPort = {
      async setPlan() {
        deniedPortCalls += 1
        throw new Error('Denied role reached the persistence port')
      },
    }
    const deniedRoles = await Promise.all((['support', 'ops', 'finance'] as const).map((role) =>
      setPlatformTenantPlan(
        { ...actor, role },
        {
          restaurantId,
          plan: 'pro',
          reason: `Runtime ${role} role authorization denial`,
          requestId: randomUUID(),
        },
        deniedPort,
      ),
    ))
    assert(
      deniedRoles.every((result) => !result.ok && result.error === 'Not authorized') && deniedPortCalls === 0,
      'A non-superadmin role reached plan persistence',
    )

    const rawRpc = service.rpc.bind(service) as unknown as RawPlanRpc
    const forgedRole = await rawRpc('set_platform_admin_tenant_plan', {
      p_restaurant_id: restaurantId,
      p_actor_user_id: actor.userId,
      p_actor_role: 'finance',
      p_plan: 'pro',
      p_reason: 'Runtime forged finance role must be rejected',
      p_request_id: randomUUID(),
    })
    assert(forgedRole.error?.code === '42501', 'Database accepted a forged platform role')

    const anon = createClient<Database>(
      env('NEXT_PUBLIC_SUPABASE_URL'),
      env('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
      { auth: { autoRefreshToken: false, persistSession: false } },
    )
    const anonRpc = anon.rpc.bind(anon) as unknown as RawPlanRpc
    const anonResult = await anonRpc('set_platform_admin_tenant_plan', {
      p_restaurant_id: restaurantId,
      p_actor_user_id: actor.userId,
      p_actor_role: actor.role,
      p_plan: 'pro',
      p_reason: 'Runtime anonymous boundary must be rejected',
      p_request_id: randomUUID(),
    })
    assert(anonResult.error?.code === '42501', 'Anonymous caller reached plan mutation')

    const changeRequestId = randomUUID()
    const changed = await setPlatformTenantPlan(actor, {
      restaurantId,
      plan: 'pro',
      reason: 'Runtime sözleşmeli Pro paket grant doğrulaması',
      requestId: changeRequestId,
    }, port)
    assert(changed.ok && changed.value.changed && changed.value.previousPlan === 'free' && changed.value.plan === 'pro', 'Plan change failed')

    const replay = await setPlatformTenantPlan(actor, {
      restaurantId,
      plan: 'pro',
      reason: 'Runtime sözleşmeli Pro paket grant doğrulaması',
      requestId: changeRequestId,
    }, port)
    assert(replay.ok && replay.value.duplicate && replay.value.requestId === changeRequestId, 'Plan replay failed')

    const { count: replayAuditRows, error: replayAuditError } = await service
      .from('platform_admin_audit_log')
      .select('id', { count: 'exact', head: true })
      .eq('actor_user_id', actor.userId)
      .eq('request_id', changeRequestId)
      .eq('target_id', restaurantId)
    if (replayAuditError) throw replayAuditError
    assert(replayAuditRows === 1, 'Idempotent replay wrote duplicate audit rows')

    const noopRequestId = randomUUID()
    const unchanged = await setPlatformTenantPlan(actor, {
      restaurantId,
      plan: 'pro',
      reason: 'Runtime mevcut Pro paket projection doğrulaması',
      requestId: noopRequestId,
    }, port)
    assert(unchanged.ok && !unchanged.value.changed && !unchanged.value.duplicate, 'No-op plan audit failed')

    const { data: customer, error: customerError } = await service
      .from('billing_customers')
      .insert({
        restaurant_id: restaurantId,
        legal_name: `Platform plan ${suffix}`,
        contact_email: `platform-plan-${suffix}@example.invalid`,
      })
      .select('id')
      .single()
    if (customerError || !customer) throw customerError ?? new Error('Billing customer unavailable')
    const { error: subscriptionError } = await service.from('billing_subscriptions').insert({
      restaurant_id: restaurantId,
      billing_customer_id: customer.id,
      plan: 'pro',
      status: 'active',
    })
    if (subscriptionError) throw subscriptionError

    const conflictRequestId = randomUUID()
    const conflict = await setPlatformTenantPlan(actor, {
      restaurantId,
      plan: 'enterprise',
      reason: 'Runtime canlı abonelikte yetkisiz projection ayrışması denemesi',
      requestId: conflictRequestId,
    }, port)
    assert(
      !conflict.ok && conflict.error === 'Tenant plan is managed by an active billing subscription',
      'Live subscription did not block a divergent plan',
    )

    const [{ data: persisted, error: persistedError }, { count: rejectedAuditRows, error: rejectedAuditError }] = await Promise.all([
      service.from('restaurants').select('plan').eq('id', restaurantId).single(),
      service.from('platform_admin_audit_log')
        .select('id', { count: 'exact', head: true })
        .eq('actor_user_id', actor.userId)
        .eq('request_id', conflictRequestId),
    ])
    if (persistedError || !persisted) throw persistedError ?? new Error('Plan projection unavailable')
    if (rejectedAuditError) throw rejectedAuditError
    assert(persisted.plan === 'pro' && rejectedAuditRows === 0, 'Rejected billing conflict changed state or audit')

    const { count: auditRows, error: auditError } = await service
      .from('platform_admin_audit_log')
      .select('id', { count: 'exact', head: true })
      .eq('action', 'tenant.plan.change')
      .eq('target_id', restaurantId)
    if (auditError) throw auditError
    immutableAuditRows = auditRows ?? -1
    assert(immutableAuditRows === 2, 'Unexpected immutable plan audit count')

    console.log(JSON.stringify({
      project: new URL(env('NEXT_PUBLIC_SUPABASE_URL')).hostname,
      tenant: { idSuffix: restaurantId.slice(-6), initialPlan: restaurant.plan, persistedPlan: persisted.plan },
      authorization: {
        deniedRoles: deniedRoles.map((result, index) => ({ role: ['support', 'ops', 'finance'][index], result })),
        persistenceCalls: deniedPortCalls,
        forgedRoleCode: forgedRole.error?.code ?? null,
        anonRpcCode: anonResult.error?.code ?? null,
      },
      idempotency: { replayAccepted: replay.ok, duplicate: replay.ok && replay.value.duplicate, auditRows: replayAuditRows },
      projection: { changed, unchanged },
      billingAuthority: { conflict, persistedPlan: persisted.plan, rejectedAuditRows },
      immutableAuditEvidence: immutableAuditRows,
    }, null, 2))
  } catch (error) {
    primaryError = error
  }

  if (restaurantId) {
    const cleanupErrors = await Promise.all([
      service.from('billing_subscriptions').delete().eq('restaurant_id', restaurantId),
    ])
    if (cleanupErrors[0].error) throw cleanupErrors[0].error
    const { error: customerDeleteError } = await service.from('billing_customers').delete().eq('restaurant_id', restaurantId)
    if (customerDeleteError) throw customerDeleteError
    const { error: restaurantDeleteError } = await service.from('restaurants').delete().eq('id', restaurantId)
    if (restaurantDeleteError) throw restaurantDeleteError
  }

  const marker = restaurantId || randomUUID()
  const [{ count: restaurants }, { count: customers }, { count: subscriptions }] = await Promise.all([
    service.from('restaurants').select('id', { count: 'exact', head: true }).eq('id', marker),
    service.from('billing_customers').select('id', { count: 'exact', head: true }).eq('restaurant_id', marker),
    service.from('billing_subscriptions').select('id', { count: 'exact', head: true }).eq('restaurant_id', marker),
  ])
  console.log(JSON.stringify({ cleanup: { restaurants, customers, subscriptions }, immutableAuditEvidence: immutableAuditRows }))
  assert(restaurants === 0 && customers === 0 && subscriptions === 0, 'Runtime cleanup left mutable orphan rows')
  if (primaryError) throw primaryError
}

void main()
