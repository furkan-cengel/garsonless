import assert from 'node:assert/strict'
import test from 'node:test'
import { err, ok } from '@garsonless/domain/result'
import type { PlatformAdminActorContext } from '@garsonless/domain/platform-admin'
import {
  listPlatformTenants,
  readPlatformTenant,
  type PlatformTenantPage,
  type PlatformTenantReadPort,
} from './platform-admin-tenants'

const tenantId = '11111111-1111-4111-8111-111111111111'
const page: PlatformTenantPage = { items: [], totalCount: 0, page: 1, pageSize: 25 }
const actor = (role: PlatformAdminActorContext['role']): PlatformAdminActorContext => ({
  actor: 'platform-admin', userId: '22222222-2222-4222-8222-222222222222', role, aal: 'aal2',
})

function port(overrides: Partial<PlatformTenantReadPort> = {}): PlatformTenantReadPort {
  return {
    listTenants: async () => ok(page),
    readTenant: async () => ok(null),
    ...overrides,
  }
}

test('every closed platform role can read the tenant directory', async () => {
  for (const role of ['support', 'ops', 'finance', 'superadmin'] as const) {
    assert.deepEqual(await listPlatformTenants(actor(role), {}, port()), { ok: true, value: page })
  }
})

test('tenant query is normalized before the port receives it', async () => {
  let received: unknown
  const result = await listPlatformTenants(actor('superadmin'), {
    search: '  Test Cafe  ', plan: 'pro', subscriptionStatus: 'past_due', lifecycle: 'all', page: 2, pageSize: 10,
  }, port({ listTenants: async (input) => { received = input; return ok({ ...page, page: 2, pageSize: 10 }) } }))
  assert.equal(result.ok, true)
  assert.deepEqual(received, {
    search: 'Test Cafe', plan: 'pro', subscriptionStatus: 'past_due', lifecycle: 'all', page: 2, pageSize: 10,
  })
})

test('invalid or excessive filters fail before touching the database', async () => {
  let calls = 0
  const database = port({ listTenants: async () => { calls += 1; return ok(page) } })
  const inputs = [
    { search: 'x'.repeat(101) },
    { page: 0 },
    { page: 401 },
    { pageSize: 11 },
    { plan: 'owner' as never },
    { subscriptionStatus: 'enabled' as never },
    { lifecycle: 'suspended' as never },
  ]
  for (const input of inputs) {
    assert.deepEqual(await listPlatformTenants(actor('superadmin'), input, database), {
      ok: false, error: 'Invalid tenant query',
    })
  }
  assert.equal(calls, 0)
})

test('tenant detail validates the identifier before querying', async () => {
  let calls = 0
  const database = port({ readTenant: async () => { calls += 1; return ok(null) } })
  assert.deepEqual(await readPlatformTenant(actor('support'), '../tenant', database), {
    ok: false, error: 'Invalid tenant id',
  })
  assert.equal(calls, 0)
  assert.deepEqual(await readPlatformTenant(actor('support'), tenantId, database), { ok: true, value: null })
  assert.equal(calls, 1)
})

test('database details collapse into stable application errors', async () => {
  const database = port({
    listTenants: async () => err('postgres list detail'),
    readTenant: async () => err('postgres detail detail'),
  })
  assert.deepEqual(await listPlatformTenants(actor('ops'), {}, database), {
    ok: false, error: 'Tenant directory could not be loaded',
  })
  assert.deepEqual(await readPlatformTenant(actor('ops'), tenantId, database), {
    ok: false, error: 'Tenant could not be loaded',
  })
})

test('a forged actor without AAL2 is denied fail-closed', async () => {
  const forged = { ...actor('superadmin'), aal: 'aal1' } as unknown as PlatformAdminActorContext
  assert.deepEqual(await listPlatformTenants(forged, {}, port()), { ok: false, error: 'Not authorized' })
})
