import assert from 'node:assert/strict'
import test from 'node:test'
import { err, ok } from '@garsonless/domain/result'
import type { PlatformAdminActorContext } from '@garsonless/domain/platform-admin'
import {
  readPlatformTenantServiceControl,
  setPlatformTenantServiceStatus,
  type PlatformTenantOperationsPort,
} from './platform-admin-tenant-operations'

const restaurantId = '11111111-1111-4111-8111-111111111111'
const requestId = '22222222-2222-4222-8222-222222222222'
const userId = '33333333-3333-4333-8333-333333333333'
const actor = (role: PlatformAdminActorContext['role']): PlatformAdminActorContext => ({
  actor: 'platform-admin', userId, role, aal: 'aal2',
})

function port(overrides: Partial<PlatformTenantOperationsPort> = {}): PlatformTenantOperationsPort {
  return {
    readServiceControl: async () => ok(null),
    setServiceStatus: async (input) => ok({
      restaurantId: input.restaurantId,
      previousStatus: 'active', status: input.status, version: 1,
      updatedAt: '2026-07-22T12:00:00.000Z', changed: true, requestId: input.requestId,
    }),
    ...overrides,
  }
}

test('missing service control projects backward-compatible active state', async () => {
  assert.deepEqual(await readPlatformTenantServiceControl(actor('support'), restaurantId, port()), {
    ok: true,
    value: { restaurantId, status: 'active', version: 0, updatedAt: null },
  })
})

test('only ops and superadmin can change tenant service status', async () => {
  let calls = 0
  const database = port({ setServiceStatus: async () => { calls += 1; return err('no') } })
  for (const role of ['support', 'finance'] as const) {
    assert.deepEqual(await setPlatformTenantServiceStatus(actor(role), {
      restaurantId, status: 'suspended', reason: 'Güvenlik incelemesi başlatıldı', requestId,
    }, database), { ok: false, error: 'Not authorized' })
  }
  assert.equal(calls, 0)
})

test('service status command normalizes reason and derives trusted actor fields', async () => {
  let received: unknown
  const result = await setPlatformTenantServiceStatus(actor('ops'), {
    restaurantId, status: 'manual_hold', reason: '  Şüpheli kullanım incelemesi  ', requestId,
  }, port({ setServiceStatus: async (input) => {
    received = input
    return ok({
      restaurantId, previousStatus: 'active', status: 'manual_hold',
      version: 1, updatedAt: '2026-07-22T12:00:00.000Z', changed: true, requestId,
    })
  } }))
  assert.equal(result.ok, true)
  assert.deepEqual(received, {
    restaurantId, actorUserId: userId, actorRole: 'ops', status: 'manual_hold',
    reason: 'Şüpheli kullanım incelemesi', requestId,
  })
})

test('invalid status, reason and request fail before the database', async () => {
  let calls = 0
  const database = port({ setServiceStatus: async () => { calls += 1; return err('no') } })
  const base = { restaurantId, status: 'active' as const, reason: 'Yeniden etkinleştirme onaylandı', requestId }
  assert.deepEqual(await setPlatformTenantServiceStatus(actor('superadmin'), { ...base, status: 'deleted' as never }, database), { ok: false, error: 'Invalid service status' })
  assert.deepEqual(await setPlatformTenantServiceStatus(actor('superadmin'), { ...base, reason: 'kısa' }, database), { ok: false, error: 'Invalid operation reason' })
  assert.deepEqual(await setPlatformTenantServiceStatus(actor('superadmin'), { ...base, requestId: 'client-value' }, database), { ok: false, error: 'Invalid request id' })
  assert.equal(calls, 0)
})

test('database details collapse to stable operation error', async () => {
  const result = await setPlatformTenantServiceStatus(actor('superadmin'), {
    restaurantId, status: 'suspended', reason: 'Operasyonel güvenlik durdurması', requestId,
  }, port({ setServiceStatus: async () => err('postgres details') }))
  assert.deepEqual(result, { ok: false, error: 'Tenant service status could not be changed' })
})
