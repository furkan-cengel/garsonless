import assert from 'node:assert/strict'
import test from 'node:test'
import { err, ok } from '@garsonless/domain/result'
import {
  readPlatformAdminIdentity,
  resolvePlatformAdminActor,
  type PlatformAdminIdentity,
  type PlatformAdminIdentityPort,
} from './platform-admin'

const userId = '11111111-1111-4111-8111-111111111111'
const port = (value: PlatformAdminIdentity | null): PlatformAdminIdentityPort => ({
  async readIdentity() {
    return ok(value)
  },
})

test('restaurant users are not inferred as platform admins', async () => {
  const result = await readPlatformAdminIdentity(userId, port(null))
  assert.deepEqual(result, { ok: false, error: 'Platform admin access is not granted' })
})

test('active identity still requires aal2 before an actor is issued', async () => {
  const identity = { userId, role: 'ops' as const, status: 'active' as const, displayName: 'Ops' }
  const result = await resolvePlatformAdminActor({ userId, currentAal: 'aal1' }, port(identity))
  assert.deepEqual(result, { ok: false, error: 'Platform admin MFA is required' })
})

test('aal2 active identity resolves the isolated platform actor', async () => {
  const identity = { userId, role: 'finance' as const, status: 'active' as const, displayName: null }
  const result = await resolvePlatformAdminActor({ userId, currentAal: 'aal2' }, port(identity))
  assert.deepEqual(result, {
    ok: true,
    value: { actor: 'platform-admin', userId, role: 'finance', aal: 'aal2' },
  })
})

test('identity infrastructure failures remain behind a stable boundary', async () => {
  const failing: PlatformAdminIdentityPort = { async readIdentity() { return err('sql details') } }
  const result = await readPlatformAdminIdentity(userId, failing)
  assert.deepEqual(result, { ok: false, error: 'Platform admin identity could not be loaded' })
})
