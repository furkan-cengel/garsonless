import assert from 'node:assert/strict'
import test from 'node:test'
import { createPlatformAdminIdentityPort, type PlatformAdminIdentityRpc } from './platform-admin-identity-port'

const userId = '11111111-1111-4111-8111-111111111111'
const rpc = (data: unknown, message?: string): PlatformAdminIdentityRpc => async () => ({
  data,
  error: message ? { message } : null,
})

test('platform admin identity RPC is parsed into a closed role/status contract', async () => {
  const result = await createPlatformAdminIdentityPort(rpc({
    userId,
    role: 'support',
    status: 'active',
    displayName: 'Support',
  })).readIdentity(userId)
  assert.deepEqual(result, {
    ok: true,
    value: { userId, role: 'support', status: 'active', displayName: 'Support' },
  })
})

test('missing membership remains null instead of inheriting tenant access', async () => {
  assert.deepEqual(
    await createPlatformAdminIdentityPort(rpc(null)).readIdentity(userId),
    { ok: true, value: null },
  )
})

test('inactive membership reaches the application boundary without being promoted', async () => {
  const result = await createPlatformAdminIdentityPort(rpc({
    userId,
    role: 'ops',
    status: 'suspended',
    displayName: null,
  })).readIdentity(userId)
  assert.deepEqual(result, {
    ok: true,
    value: { userId, role: 'ops', status: 'suspended', displayName: null },
  })
})

test('malformed identities fail closed', async () => {
  assert.deepEqual(
    await createPlatformAdminIdentityPort(rpc({ userId, role: 'owner', status: 'active' })).readIdentity(userId),
    { ok: false, error: 'platform_admin_identity_query_failed' },
  )
})

test('database details are hidden behind a stable port error', async () => {
  assert.deepEqual(
    await createPlatformAdminIdentityPort(rpc(null, 'secret SQL details')).readIdentity(userId),
    { ok: false, error: 'platform_admin_identity_query_failed' },
  )
})
