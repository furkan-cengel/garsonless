import assert from 'node:assert/strict'
import test from 'node:test'
import { createPlatformAdminTenantAccountsPort, type PlatformAccountsRpc } from './platform-admin-tenant-accounts-port'
const TENANT = '22222222-2222-4222-8222-222222222222'
const USER = '11111111-1111-4111-8111-111111111111'
const REQUEST = '33333333-3333-4333-8333-333333333333'
const input = { restaurantId: TENANT, actorUserId: USER, actorRole: 'superadmin' as const, requestId: REQUEST, reason: 'İşletme hesabı incelemesi.', userId: USER }
const response = (data: unknown) => ({ data, error: null })
const baseAccount = { userId: USER, memberId: null, role: 'owner', membershipStatus: 'active', email: 'owner@example.test', name: 'Test Owner', phone: null, createdAt: null, acceptedAt: null, lastSignInAt: null, emailConfirmedAt: null, bannedUntil: null, isBanned: false, isDeleted: false, isPlatformAdmin: false, permissions: [], pendingUnlockRequestId: null }
test('reveal returns a closed DTO and verifies tenant scope', async () => {
  const dto = { restaurantId: TENANT, accounts: [{ ...baseAccount, encrypted_password: 'secret' }], billing: null, refresh_token: 'secret' }
  const p = createPlatformAdminTenantAccountsPort(async () => response(dto))
  const result = await p.reveal(input)
  assert.deepEqual(result, { ok: true, value: { restaurantId: TENANT, accounts: [baseAccount], billing: null } })
  assert.equal((await createPlatformAdminTenantAccountsPort(async () => response({ ...dto, restaurantId: USER })).reveal(input)).ok, false)
})
test('malformed account flags, identifiers, dates, memberships and raw errors fail closed', async () => {
  for (const patch of [{ isBanned: 'false' }, { userId: 'bad' }, { createdAt: 'bad' }, { role: 'admin' }, { membershipStatus: 'root' }, { permissions: [{}] }]) {
    const result = await createPlatformAdminTenantAccountsPort(async () => response({ restaurantId: TENANT, accounts: [{ ...baseAccount, ...patch }], billing: null })).reveal(input)
    assert.equal(result.ok, false)
  }
  assert.deepEqual(await createPlatformAdminTenantAccountsPort(async () => ({ data: null, error: 'API_SECRET' })).reveal(input), { ok: false, error: 'platform_accounts_reveal_failed' })
})
test('unban writes durable intent before Auth and verifies persisted state afterwards', async () => {
  const calls: string[] = []
  const rpc: PlatformAccountsRpc = async (name, args) => {
    calls.push(name)
    assert.equal(args.p_restaurant_id, TENANT)
    return response({ requestId: REQUEST, status: name.startsWith('prepare') ? 'pending' : 'completed', execute: true })
  }
  const result = await createPlatformAdminTenantAccountsPort(rpc, async () => { calls.push('auth'); return 'accepted' }).unbanUser(input)
  assert.deepEqual(result, { ok: true, value: { requestId: REQUEST, status: 'completed' } })
  assert.deepEqual(calls, ['prepare_platform_admin_user_unban', 'auth', 'finish_platform_admin_user_unban'])
})
test('denied, malformed and duplicate preparations never call Auth', async () => {
  let calls = 0
  for (const result of [{ data: null, error: 'denied' }, response({ requestId: USER, status: 'pending', execute: true }), response({ requestId: REQUEST, status: 'pending', execute: false }), response({ requestId: REQUEST, status: 'completed', execute: true })]) {
    await createPlatformAdminTenantAccountsPort(async () => result, async () => { calls++; return 'accepted' }).unbanUser(input)
  }
  assert.equal(calls, 0)
})
test('uncertain Auth or finalization failures stay pending and never claim success', async () => {
  const p = createPlatformAdminTenantAccountsPort(async (name) => name.startsWith('prepare')
    ? response({ requestId: REQUEST, status: 'pending', execute: true }) : { data: null, error: 'db unavailable' }, async () => { throw new Error('network') })
  assert.deepEqual(await p.unbanUser(input), { ok: true, value: { requestId: REQUEST, status: 'pending' } })
})
test('reconciliation does not issue an Auth update, rejection alone never fabricates completion', async () => {
  let calls = 0
  const p = createPlatformAdminTenantAccountsPort(async () => response({ requestId: REQUEST, status: 'pending' }), async () => { calls++; return 'accepted' })
  assert.deepEqual(await p.reconcileUnban(input), { ok: true, value: { requestId: REQUEST, status: 'pending' } })
  assert.equal(calls, 0)
})
