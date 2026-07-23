import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { createClient } from '@supabase/supabase-js'
import {
  changePlatformTenantFeatureOverride,
  type PlatformTenantEntitlementMutationPort,
} from '@garsonless/application/platform-admin-entitlements'
import type { PlatformAdminActorContext } from '@garsonless/domain/platform-admin'
import { createServiceClient } from '../src/client'
import { canRestaurantUseFeature } from '../src/feature-entitlement-port'
import { createPlatformAdminEntitlementPort } from '../src/platform-admin-entitlement-port'
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
  name: 'change_platform_admin_tenant_feature_override',
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
      service.from('platform_admin_users').select('user_id, role, status').eq('role', 'superadmin').eq('status', 'active').limit(1).single(),
    ])
    if (fixtureError || !fixture?.owner_id) throw fixtureError ?? new Error('Test Cafe B fixture unavailable')
    if (identityError || !identity) throw identityError ?? new Error('Active superadmin unavailable')

    const actor: PlatformAdminActorContext = {
      actor: 'platform-admin', userId: identity.user_id, role: 'superadmin', aal: 'aal2',
    }
    const { data: restaurant, error: restaurantError } = await service.from('restaurants').insert({
      owner_id: fixture.owner_id,
      slug: `platform-entitlement-${suffix}`,
      name: `Platform entitlement ${suffix}`,
      plan: 'free',
    }).select('id').single()
    if (restaurantError || !restaurant) throw restaurantError ?? new Error('Throwaway tenant unavailable')
    restaurantId = restaurant.id

    let deniedPortCalls = 0
    const deniedPort: PlatformTenantEntitlementMutationPort = {
      async changeOverride() {
        deniedPortCalls += 1
        throw new Error('Denied actor reached persistence')
      },
    }
    const denied = await changePlatformTenantFeatureOverride({ ...actor, role: 'finance' }, {
      restaurantId, action: 'set', feature: 'loyalty', decision: 'allow', durationDays: 1,
      reason: 'Finance rolü entitlement değiştiremez', requestId: randomUUID(),
    }, deniedPort)
    assert(!denied.ok && denied.error === 'Not authorized' && deniedPortCalls === 0, 'Finance reached entitlement persistence')

    const rawRpc = service.rpc.bind(service) as unknown as RawRpc
    const forged = await rawRpc('change_platform_admin_tenant_feature_override', {
      p_restaurant_id: restaurantId,
      p_actor_user_id: actor.userId,
      p_actor_role: 'ops',
      p_action: 'set',
      p_feature: 'loyalty',
      p_decision: 'allow',
      p_duration_days: 1,
      p_reason: 'Forged role must be rejected by database',
      p_request_id: randomUUID(),
    })
    assert(forged.error?.code === '42501', 'Database accepted a forged platform role')

    const anon = createClient<Database>(env('NEXT_PUBLIC_SUPABASE_URL'), env('NEXT_PUBLIC_SUPABASE_ANON_KEY'), {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const anonRpc = anon.rpc.bind(anon) as unknown as RawRpc
    const anonResult = await anonRpc('change_platform_admin_tenant_feature_override', {
      p_restaurant_id: restaurantId,
      p_actor_user_id: actor.userId,
      p_actor_role: actor.role,
      p_action: 'set',
      p_feature: 'loyalty',
      p_decision: 'allow',
      p_duration_days: 1,
      p_reason: 'Anonymous caller must be rejected by database',
      p_request_id: randomUUID(),
    })
    assert(anonResult.error?.code === '42501', 'Anonymous caller reached entitlement mutation')
    const { error: anonTableError } = await anon.from('tenant_feature_overrides').select('feature').eq('restaurant_id', restaurantId)
    assert(anonTableError?.code === '42501', 'Anonymous caller read entitlement projection')

    const port = createPlatformAdminEntitlementPort()
    const baseline = await canRestaurantUseFeature({ restaurantId, plan: 'free', feature: 'loyalty' })
    assert(!baseline, 'Free plan unexpectedly had loyalty access')

    const allowRequestId = randomUUID()
    const allow = await changePlatformTenantFeatureOverride(actor, {
      restaurantId, action: 'set', feature: 'loyalty', decision: 'allow', durationDays: 1,
      reason: 'Destek vakası için kontrollü bir günlük erişim', requestId: allowRequestId,
    }, port)
    assert(allow.ok && allow.value.after?.decision === 'allow', 'Allow override failed')
    assert(await canRestaurantUseFeature({ restaurantId, plan: 'free', feature: 'loyalty' }), 'Allow override did not open runtime gate')

    const replay = await changePlatformTenantFeatureOverride(actor, {
      restaurantId, action: 'set', feature: 'loyalty', decision: 'allow', durationDays: 1,
      reason: 'Destek vakası için kontrollü bir günlük erişim', requestId: allowRequestId,
    }, port)
    assert(replay.ok && replay.value.duplicate, 'Allow replay was not idempotent')
    const { count: replayAuditRows, error: replayAuditError } = await service.from('platform_admin_audit_log')
      .select('id', { count: 'exact', head: true })
      .eq('actor_user_id', actor.userId)
      .eq('request_id', allowRequestId)
    if (replayAuditError) throw replayAuditError
    assert(replayAuditRows === 1, 'Allow replay wrote duplicate audit rows')

    const revoke = await changePlatformTenantFeatureOverride(actor, {
      restaurantId, action: 'revoke', feature: 'loyalty',
      reason: 'Geçici destek erişimi erken sonlandırıldı', requestId: randomUUID(),
    }, port)
    assert(revoke.ok && revoke.value.after === null, 'Override revoke failed')
    assert(!await canRestaurantUseFeature({ restaurantId, plan: 'free', feature: 'loyalty' }), 'Revoke did not restore free plan gate')

    const { error: planError } = await service.from('restaurants').update({ plan: 'pro' }).eq('id', restaurantId)
    if (planError) throw planError
    assert(await canRestaurantUseFeature({ restaurantId, plan: 'pro', feature: 'loyalty' }), 'Pro plan loyalty baseline missing')

    const deny = await changePlatformTenantFeatureOverride(actor, {
      restaurantId, action: 'set', feature: 'loyalty', decision: 'deny', durationDays: 1,
      reason: 'Güvenlik incelemesi boyunca erişim kapatıldı', requestId: randomUUID(),
    }, port)
    assert(deny.ok && deny.value.after?.decision === 'deny', 'Deny override failed')
    assert(!await canRestaurantUseFeature({ restaurantId, plan: 'pro', feature: 'loyalty' }), 'Deny override did not close runtime gate')

    const expiresAt = new Date(Date.now() + 250).toISOString()
    const { error: expiryUpdateError } = await service.from('tenant_feature_overrides')
      .update({ expires_at: expiresAt })
      .eq('restaurant_id', restaurantId)
      .eq('feature', 'loyalty')
    if (expiryUpdateError) throw expiryUpdateError
    await delay(400)
    assert(await canRestaurantUseFeature({ restaurantId, plan: 'pro', feature: 'loyalty' }), 'Expired deny did not fall back to Pro plan')

    const { count: auditRows, error: auditError } = await service.from('platform_admin_audit_log')
      .select('id', { count: 'exact', head: true })
      .eq('target_type', 'restaurant_feature')
      .eq('target_id', `${restaurantId}:loyalty`)
    if (auditError) throw auditError
    immutableAuditRows = auditRows ?? -1
    assert(immutableAuditRows === 3, 'Unexpected immutable entitlement audit count')

    console.log(JSON.stringify({
      project: new URL(env('NEXT_PUBLIC_SUPABASE_URL')).hostname,
      authorization: { denied, persistenceCalls: deniedPortCalls, forgedRoleCode: forged.error?.code, anonRpcCode: anonResult.error?.code, anonTableCode: anonTableError.code },
      allow: { baseline, applied: allow.ok, runtimeAllowed: true, replayDuplicate: replay.ok && replay.value.duplicate, auditRows: replayAuditRows },
      revoke: { applied: revoke.ok, runtimeAllowed: false },
      deny: { applied: deny.ok, runtimeAllowed: false },
      expiry: { expiresAt, fallbackToPlan: true },
      immutableAuditEvidence: immutableAuditRows,
    }, null, 2))
  } catch (error) {
    primaryError = error
  }

  if (restaurantId) {
    const { error: restaurantDeleteError } = await service.from('restaurants').delete().eq('id', restaurantId)
    if (restaurantDeleteError) throw restaurantDeleteError
  }
  const marker = restaurantId || randomUUID()
  const [{ count: overrides, error: overrideCountError }, { count: restaurants, error: restaurantCountError }] = await Promise.all([
    service.from('tenant_feature_overrides').select('restaurant_id', { count: 'exact', head: true }).eq('restaurant_id', marker),
    service.from('restaurants').select('id', { count: 'exact', head: true }).eq('id', marker),
  ])
  if (overrideCountError || restaurantCountError) throw overrideCountError ?? restaurantCountError
  assert(overrides === 0 && restaurants === 0, 'Runtime cleanup left mutable rows')
  console.log(JSON.stringify({ cleanup: { tenantFeatureOverrides: overrides, restaurants }, immutableAuditEvidence: immutableAuditRows }))
  if (primaryError) throw primaryError
}

void main()
