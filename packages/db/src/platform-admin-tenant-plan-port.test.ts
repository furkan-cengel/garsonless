import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createPlatformAdminTenantPlanManagementPort,
  type PlatformTenantPlanRpc,
} from './platform-admin-tenant-plan-port'

const restaurantId = '11111111-1111-4111-8111-111111111111'
const requestId = '22222222-2222-4222-8222-222222222222'
const actorUserId = '33333333-3333-4333-8333-333333333333'

test('tenant plan port maps trusted command arguments and parses projection', async () => {
  let received: unknown
  const rpc: PlatformTenantPlanRpc = async (name, args) => {
    received = { name, args }
    return {
      data: {
        restaurantId, previousPlan: 'starter', plan: 'pro', changed: true,
        duplicate: false, requestId,
      },
      error: null,
    }
  }
  const result = await createPlatformAdminTenantPlanManagementPort(rpc).setPlan({
    restaurantId, actorUserId, actorRole: 'superadmin', plan: 'pro',
    reason: 'Kurumsal paket düzeltmesi onaylandı', requestId,
  })
  assert.equal(result.ok, true)
  assert.deepEqual(received, {
    name: 'set_platform_admin_tenant_plan',
    args: {
      p_restaurant_id: restaurantId,
      p_actor_user_id: actorUserId,
      p_actor_role: 'superadmin',
      p_plan: 'pro',
      p_reason: 'Kurumsal paket düzeltmesi onaylandı',
      p_request_id: requestId,
    },
  })
})

test('live billing conflict is preserved without leaking other database errors', async () => {
  const conflict: PlatformTenantPlanRpc = async () => ({
    data: null,
    error: { message: 'platform_tenant_plan_billing_managed' },
  })
  assert.deepEqual(await createPlatformAdminTenantPlanManagementPort(conflict).setPlan({
    restaurantId, actorUserId, actorRole: 'superadmin', plan: 'starter',
    reason: 'Paket düzeltmesi canlı abonelikte deneniyor', requestId,
  }), { ok: false, error: 'platform_tenant_plan_billing_managed' })

  const internal: PlatformTenantPlanRpc = async () => ({
    data: null,
    error: { message: 'relation and provider details' },
  })
  assert.deepEqual(await createPlatformAdminTenantPlanManagementPort(internal).setPlan({
    restaurantId, actorUserId, actorRole: 'superadmin', plan: 'starter',
    reason: 'Paket düzeltmesi tekrar deneniyor', requestId,
  }), { ok: false, error: 'platform_tenant_plan_mutation_failed' })
})

test('malformed plan projections fail closed', async () => {
  const malformed: PlatformTenantPlanRpc = async () => ({
    data: {
      restaurantId, previousPlan: 'starter', plan: 'unknown', changed: true,
      duplicate: false, requestId,
    },
    error: null,
  })
  assert.deepEqual(await createPlatformAdminTenantPlanManagementPort(malformed).setPlan({
    restaurantId, actorUserId, actorRole: 'superadmin', plan: 'pro',
    reason: 'Kurumsal paket düzeltmesi onaylandı', requestId,
  }), { ok: false, error: 'platform_tenant_plan_mutation_failed' })
})
