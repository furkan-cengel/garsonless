import assert from 'node:assert/strict'
import test from 'node:test'
import type { PlatformAdminActorContext } from '@garsonless/domain/platform-admin'
import { ok } from '@garsonless/domain/result'
import {
  changePlatformTenantFeatureOverride,
  readPlatformTenantFeatureOverrides,
  type PlatformTenantEntitlementMutationPort,
  type PlatformTenantEntitlementReadPort,
} from './platform-admin-entitlements'

const restaurantId = '11111111-1111-4111-8111-111111111111'
const requestId = '22222222-2222-4222-8222-222222222222'
const actor: PlatformAdminActorContext = {
  actor: 'platform-admin',
  userId: '33333333-3333-4333-8333-333333333333',
  role: 'superadmin',
  aal: 'aal2',
}

test('all platform roles can read tenant overrides but only ops/superadmin can mutate', async () => {
  let reads = 0
  let writes = 0
  const readPort: PlatformTenantEntitlementReadPort = {
    async readOverrides() { reads += 1; return ok([]) },
  }
  const mutationPort: PlatformTenantEntitlementMutationPort = {
    async changeOverride(input) {
      writes += 1
      return ok({
        restaurantId, feature: input.feature, action: input.action,
        before: null, after: null, duplicate: false, requestId,
      })
    },
  }

  for (const role of ['support', 'ops', 'finance', 'superadmin'] as const) {
    assert.equal((await readPlatformTenantFeatureOverrides({ ...actor, role }, restaurantId, readPort)).ok, true)
  }
  for (const role of ['support', 'finance'] as const) {
    assert.deepEqual(await changePlatformTenantFeatureOverride({ ...actor, role }, {
      restaurantId, action: 'revoke', feature: 'loyalty', reason: 'Geçici ayrıcalık erken sonlandırıldı', requestId,
    }, mutationPort), { ok: false, error: 'Not authorized' })
  }
  assert.equal((await changePlatformTenantFeatureOverride({ ...actor, role: 'ops' }, {
    restaurantId, action: 'revoke', feature: 'loyalty', reason: 'Geçici ayrıcalık erken sonlandırıldı', requestId,
  }, mutationPort)).ok, true)
  assert.equal(reads, 4)
  assert.equal(writes, 1)
})

test('set validates bounded duration, decision and reason before persistence', async () => {
  let calls = 0
  const port: PlatformTenantEntitlementMutationPort = {
    async changeOverride(input) {
      calls += 1
      return ok({ restaurantId, feature: input.feature, action: input.action, before: null, after: null, duplicate: false, requestId })
    },
  }
  const base = { restaurantId, action: 'set' as const, feature: 'loyalty' as const, decision: 'allow' as const, durationDays: 7, reason: 'Yedi günlük kontrollü özellik erişimi', requestId }
  for (const input of [
    { ...base, restaurantId: 'forged' },
    { ...base, feature: 'forged' as 'loyalty' },
    { ...base, decision: 'forged' as 'allow' },
    { ...base, durationDays: 0 },
    { ...base, durationDays: 31 },
    { ...base, reason: 'kısa' },
    { ...base, requestId: 'forged' },
    { ...base, feature: 'orders' as 'loyalty' },
  ]) {
    assert.equal((await changePlatformTenantFeatureOverride(actor, input, port)).ok, false)
  }
  assert.equal(calls, 0)
})

test('trusted actor fields and normalized inputs are passed to the mutation port', async () => {
  let received: unknown
  const port: PlatformTenantEntitlementMutationPort = {
    async changeOverride(input) {
      received = input
      return ok({ restaurantId, feature: input.feature, action: input.action, before: null, after: null, duplicate: false, requestId })
    },
  }
  assert.equal((await changePlatformTenantFeatureOverride({ ...actor, role: 'ops' }, {
    restaurantId, action: 'set', feature: 'browser_notifications', decision: 'deny', durationDays: 3,
    reason: '  Güvenlik incelemesi boyunca erişim kapatıldı  ', requestId,
  }, port)).ok, true)
  assert.deepEqual(received, {
    restaurantId,
    actorUserId: actor.userId,
    actorRole: 'ops',
    action: 'set',
    feature: 'browser_notifications',
    decision: 'deny',
    durationDays: 3,
    reason: 'Güvenlik incelemesi boyunca erişim kapatıldı',
    requestId,
  })
})

test('persistence details collapse into stable public errors', async () => {
  const readPort: PlatformTenantEntitlementReadPort = { async readOverrides() { return { ok: false, error: 'raw SQL detail' } } }
  const mutationPort: PlatformTenantEntitlementMutationPort = { async changeOverride() { return { ok: false, error: 'raw SQL detail' } } }
  assert.deepEqual(await readPlatformTenantFeatureOverrides(actor, restaurantId, readPort), {
    ok: false, error: 'Feature overrides could not be loaded',
  })
  assert.deepEqual(await changePlatformTenantFeatureOverride(actor, {
    restaurantId, action: 'revoke', feature: 'loyalty', reason: 'Geçici ayrıcalık erken sonlandırıldı', requestId,
  }, mutationPort), { ok: false, error: 'Feature override could not be changed' })
})
