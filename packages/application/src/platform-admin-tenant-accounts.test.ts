import assert from 'node:assert/strict'
import test from 'node:test'
import { ok, err } from '@garsonless/domain/result'
import type { PlatformAdminActorContext } from '@garsonless/domain/platform-admin'
import { activatePlatformTenantAccount, PLATFORM_MEMBER_CONFIRMATION, PLATFORM_UNBAN_CONFIRMATION, reconcilePlatformTenantUnban, revealPlatformTenantAccounts, type PlatformTenantAccountsPort } from './platform-admin-tenant-accounts'

const USER = '11111111-1111-4111-8111-111111111111'
const TENANT = '22222222-2222-4222-8222-222222222222'
const REQUEST = '33333333-3333-4333-8333-333333333333'
const TARGET = '44444444-4444-4444-8444-444444444444'
const actor: PlatformAdminActorContext = { actor: 'platform-admin', userId: USER, role: 'superadmin', aal: 'aal2' }
const input = { restaurantId: TENANT, requestId: REQUEST, reason: '  İşletme hesabının destek incelemesi.  ' }
function port(overrides: Partial<PlatformTenantAccountsPort> = {}): PlatformTenantAccountsPort {
  return { reveal: async () => ok({ restaurantId: TENANT, accounts: [], billing: null }), reactivateMember: async () => ok({ requestId: REQUEST, status: 'completed' }), unbanUser: async () => ok({ requestId: REQUEST, status: 'pending' }), reconcileUnban: async () => ok({ requestId: REQUEST, status: 'completed' }), ...overrides }
}
test('contact access and account operations require the AAL2 superadmin, not tenant ownership or staff roles', async () => {
  let calls = 0
  const p = port({ reveal: async () => { calls++; return err('unexpected') }, unbanUser: async () => { calls++; return err('unexpected') }, reconcileUnban: async () => { calls++; return err('unexpected') } })
  for (const candidate of [{ ...actor, role: 'support' }, { ...actor, role: 'ops' }, { ...actor, role: 'finance' }, { ...actor, aal: 'aal1' }] as PlatformAdminActorContext[]) {
    assert.equal((await revealPlatformTenantAccounts(candidate, input, p)).ok, false)
    assert.equal((await activatePlatformTenantAccount(candidate, { ...input, targetId: TARGET, kind: 'auth_unban', confirmation: PLATFORM_UNBAN_CONFIRMATION }, p)).ok, false)
    assert.equal((await reconcilePlatformTenantUnban(candidate, input, p)).ok, false)
  }
  assert.equal(calls, 0)
})
test('invalid identifiers, short/long reasons and confirmation never cross the port', async () => {
  let calls = 0
  const p = port({ reveal: async () => { calls++; return err('unexpected') }, unbanUser: async () => { calls++; return err('unexpected') } })
  for (const patch of [{ restaurantId: 'invalid' }, { requestId: 'invalid' }, { reason: 'short' }, { reason: 'x'.repeat(1001) }]) {
    assert.equal((await revealPlatformTenantAccounts(actor, { ...input, ...patch }, p)).ok, false)
  }
  for (const patch of [{ targetId: 'bad' }, { kind: 'set_password' }, { confirmation: 'yes' }]) {
    assert.equal((await activatePlatformTenantAccount(actor, { ...input, targetId: TARGET, kind: 'auth_unban', confirmation: PLATFORM_UNBAN_CONFIRMATION, ...patch }, p)).ok, false)
  }
  assert.equal(calls, 0)
})
test('trusted actor, trimmed reason and only the selected command reach persistence', async () => {
  let captured: unknown
  const p = port({ reactivateMember: async (value) => { captured = value; return ok({ requestId: REQUEST, status: 'completed' }) } })
  assert.equal((await activatePlatformTenantAccount(actor, { ...input, targetId: TARGET, kind: 'member_reactivate', confirmation: PLATFORM_MEMBER_CONFIRMATION }, p)).ok, true)
  assert.deepEqual(captured, { restaurantId: TENANT, requestId: REQUEST, reason: input.reason.trim(), actorUserId: USER, actorRole: 'superadmin', memberId: TARGET })
})
test('provider and SQL details never appear in application errors', async () => {
  const secret = 'raw_private_database_detail'
  const result = await revealPlatformTenantAccounts(actor, input, port({ reveal: async () => err(secret) }))
  assert.equal(result.ok, false)
  assert.doesNotMatch(JSON.stringify(result), /raw_private/)
})
