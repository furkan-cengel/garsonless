import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createPlatformAdminEntitlementPort,
  type PlatformEntitlementRpc,
} from './platform-admin-entitlement-port'

const restaurantId = '11111111-1111-4111-8111-111111111111'
const actorUserId = '22222222-2222-4222-8222-222222222222'
const requestId = '33333333-3333-4333-8333-333333333333'
const override = {
  restaurantId,
  feature: 'loyalty',
  decision: 'allow',
  expiresAt: '2026-07-29T12:00:00.000Z',
  reason: 'Yedi günlük kontrollü özellik erişimi',
  updatedAt: '2026-07-22T12:00:00.000Z',
  updatedBy: actorUserId,
}

test('admin entitlement port maps tenant-scoped read arguments and parses rows', async () => {
  let received: unknown
  const rpc: PlatformEntitlementRpc = async (name, args) => {
    received = { name, args }
    return { data: [override], error: null }
  }
  const result = await createPlatformAdminEntitlementPort(rpc).readOverrides({
    restaurantId, actorUserId, actorRole: 'ops',
  })
  assert.equal(result.ok && result.value.length, 1)
  assert.deepEqual(received, {
    name: 'read_platform_admin_tenant_feature_overrides',
    args: { p_restaurant_id: restaurantId, p_actor_user_id: actorUserId, p_actor_role: 'ops' },
  })
})

test('admin entitlement port maps mutation authority and parses before/after projection', async () => {
  let received: unknown
  const rpc: PlatformEntitlementRpc = async (name, args) => {
    received = { name, args }
    return {
      data: { restaurantId, feature: 'loyalty', action: 'set', before: null, after: override, duplicate: false, requestId },
      error: null,
    }
  }
  const result = await createPlatformAdminEntitlementPort(rpc).changeOverride({
    restaurantId, actorUserId, actorRole: 'ops', action: 'set', feature: 'loyalty',
    decision: 'allow', durationDays: 7, reason: override.reason, requestId,
  })
  assert.equal(result.ok && result.value.after?.decision, 'allow')
  assert.deepEqual(received, {
    name: 'change_platform_admin_tenant_feature_override',
    args: {
      p_restaurant_id: restaurantId,
      p_actor_user_id: actorUserId,
      p_actor_role: 'ops',
      p_action: 'set',
      p_feature: 'loyalty',
      p_decision: 'allow',
      p_duration_days: 7,
      p_reason: override.reason,
      p_request_id: requestId,
    },
  })
})

test('malformed and raw database responses fail closed', async () => {
  const failed: PlatformEntitlementRpc = async () => ({ data: null, error: { message: 'raw SQL detail' } })
  assert.equal((await createPlatformAdminEntitlementPort(failed).readOverrides({ restaurantId, actorUserId, actorRole: 'ops' })).ok, false)

  const malformed: PlatformEntitlementRpc = async () => ({
    data: { restaurantId, feature: 'forged', action: 'set', before: null, after: null, duplicate: false, requestId },
    error: null,
  })
  assert.deepEqual(await createPlatformAdminEntitlementPort(malformed).changeOverride({
    restaurantId, actorUserId, actorRole: 'ops', action: 'revoke', feature: 'loyalty',
    decision: null, durationDays: null, reason: 'Geçici ayrıcalık erken sonlandırıldı', requestId,
  }), { ok: false, error: 'platform_entitlement_mutation_failed' })
})
