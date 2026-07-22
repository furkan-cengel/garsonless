import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createPlatformAdminTenantOperationsPort,
  readTenantOrderIngressStatus,
  type PlatformTenantOperationsRpc,
} from './platform-admin-tenant-operations-port'

const restaurantId = '11111111-1111-4111-8111-111111111111'
const requestId = '22222222-2222-4222-8222-222222222222'
const actorUserId = '33333333-3333-4333-8333-333333333333'

test('tenant operation port maps read and trusted mutation arguments', async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  const rpc: PlatformTenantOperationsRpc = async (name, args) => {
    calls.push({ name, args })
    if (name === 'read_platform_admin_tenant_service_control') return {
      data: { restaurantId, status: 'active', version: 0, updatedAt: null }, error: null,
    }
    return {
      data: {
        restaurantId, previousStatus: 'active', status: 'suspended', version: 1,
        updatedAt: '2026-07-22T12:00:00.000Z', changed: true, requestId,
      },
      error: null,
    }
  }
  const port = createPlatformAdminTenantOperationsPort(rpc)
  assert.equal((await port.readServiceControl(restaurantId)).ok, true)
  assert.equal((await port.setServiceStatus({
    restaurantId, actorUserId, actorRole: 'ops', status: 'suspended',
    reason: 'Güvenlik incelemesi başlatıldı', requestId,
  })).ok, true)
  assert.deepEqual(calls[1], {
    name: 'set_platform_admin_tenant_service_status',
    args: {
      p_restaurant_id: restaurantId,
      p_actor_user_id: actorUserId,
      p_actor_role: 'ops',
      p_status: 'suspended',
      p_reason: 'Güvenlik incelemesi başlatıldı',
      p_request_id: requestId,
    },
  })
})

test('malformed projections and query failures fail closed', async () => {
  const malformed: PlatformTenantOperationsRpc = async () => ({
    data: { restaurantId, status: 'billing_error', version: 1, updatedAt: null }, error: null,
  })
  assert.deepEqual(await createPlatformAdminTenantOperationsPort(malformed).readServiceControl(restaurantId), {
    ok: false, error: 'platform_tenant_service_control_query_failed',
  })
  assert.equal(await readTenantOrderIngressStatus(restaurantId, malformed), 'unavailable')
})

test('order ingress reads the same canonical service status', async () => {
  const rpc: PlatformTenantOperationsRpc = async () => ({
    data: { restaurantId, status: 'manual_hold', version: 2, updatedAt: '2026-07-22T12:00:00Z' },
    error: null,
  })
  assert.equal(await readTenantOrderIngressStatus(restaurantId, rpc), 'manual_hold')
})
