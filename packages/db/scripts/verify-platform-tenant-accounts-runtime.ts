// Explicit DEV-only integration test. Uses generated users and genuine Auth MFA.
// No email is sent. Audit-linked fixtures are retained, disabled and soft-deleted.
import assert from 'node:assert/strict'
import { createHmac, randomBytes, randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { resolvePlatformAdminActor } from '@garsonless/application/platform-admin'
import { activatePlatformTenantAccount, revealPlatformTenantAccounts, PLATFORM_MEMBER_CONFIRMATION, PLATFORM_UNBAN_CONFIRMATION } from '@garsonless/application/platform-admin-tenant-accounts'
import { createPlatformAdminIdentityPort } from '../src/platform-admin-identity-port'
import { createPlatformAdminTenantAccountsPort, type PlatformAccountsRpc } from '../src/platform-admin-tenant-accounts-port'

const DEV = 'yxsegwkzyiscrxiwdeuf.supabase.co'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
if (new URL(url).hostname !== DEV || !process.argv.includes('--apply-dev-fixtures')) throw new Error('DEV target and --apply-dev-fixtures are required')
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!key || !anonKey) throw new Error('Missing DEV credentials')
const opts = { auth: { autoRefreshToken: false, persistSession: false } }
const service = createClient(url, key, opts)
const client = () => createClient(url, anonKey, opts)
const runId = randomUUID()
const password = `${randomBytes(24).toString('base64url')}A!9`
const users: string[] = [], tenants: string[] = []
const sessions: ReturnType<typeof client>[] = []
const reason = `DEV account release verification ${runId}`
let adminId: string | null = null
let checks = 0
function must<T>(r: { data: T; error: { code?: string } | null }, label: string): T {
  if (r.error) throw new Error(`${label}: ${r.error.code ?? 'request_failed'}`)
  return r.data
}
async function check(name: string, run: () => Promise<void>) { await run(); checks++; console.log(`PASS ${name}`) }
function totp(secret: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const bits = [...secret.replace(/=+$/, '').toUpperCase()].map(c => alphabet.indexOf(c).toString(2).padStart(5, '0')).join('')
  const bytes = Buffer.from((bits.match(/.{8}/g) ?? []).map(b => parseInt(b, 2)))
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)))
  const digest = createHmac('sha1', bytes).update(counter).digest()
  return String((digest.readUInt32BE(digest[19]! & 15) & 0x7fffffff) % 1_000_000).padStart(6, '0')
}
async function newUser(label: string) {
  const email = `account-release-${runId}-${label}@example.test`
  const { user } = must(await service.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: `DEV ${label}` } }), 'create synthetic user')
  assert.ok(user); users.push(user.id)
  return { id: user.id, email }
}
async function signIn(email: string) {
  const session = client(); sessions.push(session)
  must(await session.auth.signInWithPassword({ email, password }), 'synthetic sign in')
  return session
}
async function main() {
  const admin = await newUser('admin'); adminId = admin.id
  const owner = await newUser('owner'), staff = await newUser('staff'), outsider = await newUser('outsider')
  must(await service.from('platform_admin_users').insert({ user_id: admin.id, role: 'superadmin', status: 'active', display_name: 'DEV account release fixture', activated_at: new Date().toISOString() }), 'create synthetic admin')
  for (const [label, user] of [['primary', owner], ['other', outsider]] as const) {
    const row = must(await service.from('restaurants').insert({ name: `DEV account release ${label}`, slug: `account-release-${runId}-${label}`, owner_id: user.id }).select('id').single(), 'create synthetic restaurant')
    tenants.push(row.id)
  }
  const restaurantId = tenants[0]!, otherId = tenants[1]!
  const member = must(await service.from('restaurant_members').insert({ restaurant_id: restaurantId, user_id: staff.id, email: staff.email, status: 'disabled', permissions: ['orders'], accepted_at: new Date().toISOString() }).select('id').single(), 'create synthetic member')
  const invite = must(await service.from('restaurant_members').insert({ restaurant_id: restaurantId, email: `account-release-${runId}-invite@example.test`, status: 'invited', permissions: [] }).select('id').single(), 'create synthetic invitation')
  must(await service.from('billing_customers').insert({ restaurant_id: restaurantId, legal_name: 'DEV synthetic company', contact_email: owner.email, billing_address: { city: 'İstanbul', private_marker: 'not-in-dto' } }), 'create synthetic billing profile')
  const adminSession = await signIn(admin.email), ownerSession = await signIn(owner.email), staffSession = await signIn(staff.email)
  const identity = createPlatformAdminIdentityPort()
  const getActor = async () => {
    const { user } = must(await adminSession.auth.getUser(), 'validate Auth user'); assert.ok(user)
    const aal = must(await adminSession.auth.mfa.getAuthenticatorAssuranceLevel(), 'read MFA assurance')
    return resolvePlatformAdminActor({ userId: user.id, currentAal: aal.currentLevel }, identity)
  }
  await check('actual AAL1 admin is rejected before MFA', async () => { const r = await getActor(); assert.equal(r.ok, false) })
  const factor = must(await adminSession.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'DEV release test' }), 'enroll synthetic MFA')
  must(await adminSession.auth.mfa.challengeAndVerify({ factorId: factor.id, code: totp(factor.totp.secret) }), 'verify synthetic MFA')
  const actorResult = await getActor(); assert.ok(actorResult.ok); const actor = actorResult.value
  await check('actual MFA challenge produces AAL2 superadmin', async () => { assert.equal(actor.aal, 'aal2'); assert.equal(actor.role, 'superadmin') })
  const port = createPlatformAdminTenantAccountsPort()
  const input = () => ({ restaurantId, reason, requestId: randomUUID() })
  const rpcArgs = () => ({ p_restaurant_id: restaurantId, p_actor_user_id: admin.id, p_actor_role: 'superadmin', p_reason: reason, p_request_id: randomUUID() })
  await check('anon, owner, staff and AAL2 clients cannot directly access privileged RPCs or ledger', async () => {
    for (const session of [client(), ownerSession, staffSession, adminSession]) {
      assert.ok((await session.rpc('reveal_platform_admin_tenant_accounts', rpcArgs())).error)
      assert.ok((await session.from('platform_account_unlocks').select('request_id').limit(1)).error)
    }
    for (const user of [owner, staff]) assert.equal((await resolvePlatformAdminActor({ userId: user.id, currentAal: 'aal2' }, identity)).ok, false)
  })
  await check('reveal returns scoped owner/team/billing only and audits no personal values', async () => {
    const request = input(), r = await revealPlatformTenantAccounts(actor, request, port); assert.ok(r.ok)
    assert.equal(r.value.accounts.length, 3); assert.equal(r.value.accounts[0]?.email, owner.email)
    assert.equal(r.value.billing?.legalName, 'DEV synthetic company')
    assert.equal(r.value.accounts.some(a => a.userId === outsider.id), false)
    assert.doesNotMatch(JSON.stringify(r.value), /not-in-dto|encrypted_password|refresh_token/)
    const audit = must(await service.from('platform_admin_audit_log').select('before_state,after_state').eq('request_id', request.requestId).single(), 'read fixture audit')
    assert.doesNotMatch(JSON.stringify(audit), /example\.test|DEV synthetic company/)
  })
  await check('support role and suspended admin are denied by application and database', async () => {
    try {
      must(await service.from('platform_admin_users').update({ role: 'support' }).eq('user_id', admin.id), 'fixture role change')
      const support = await getActor(); assert.ok(support.ok)
      assert.equal((await revealPlatformTenantAccounts(support.value, input(), port)).ok, false)
      assert.ok((await service.rpc('reveal_platform_admin_tenant_accounts', rpcArgs())).error)
      must(await service.from('platform_admin_users').update({ role: 'superadmin', status: 'suspended' }).eq('user_id', admin.id), 'suspend fixture admin')
      assert.equal((await getActor()).ok, false)
      assert.ok((await service.rpc('reveal_platform_admin_tenant_accounts', rpcArgs())).error)
    } finally { must(await service.from('platform_admin_users').update({ role: 'superadmin', status: 'active' }).eq('user_id', admin.id), 'restore fixture admin') }
  })
  await check('staff reactivation preserves grants; replay, invitation and cross-tenant guards work', async () => {
    const request = { ...input(), kind: 'member_reactivate', targetId: member.id, confirmation: PLATFORM_MEMBER_CONFIRMATION }
    assert.equal(must(await staffSession.rpc('has_restaurant_access', { p_restaurant_id: restaurantId }), 'disabled staff access'), false)
    const r = await activatePlatformTenantAccount(actor, request, port); assert.ok(r.ok); assert.equal(r.value.status, 'completed')
    assert.equal((await activatePlatformTenantAccount(actor, request, port)).ok, true)
    assert.deepEqual(must(await service.from('restaurant_members').select('status,permissions').eq('id', member.id).single(), 'fixture member state'), { status: 'active', permissions: ['orders'] })
    assert.equal(must(await staffSession.rpc('has_restaurant_access', { p_restaurant_id: restaurantId }), 'active staff access'), true)
    assert.equal((await activatePlatformTenantAccount(actor, { ...request, requestId: randomUUID(), restaurantId: otherId }, port)).ok, false)
    assert.equal((await activatePlatformTenantAccount(actor, { ...request, requestId: randomUUID(), targetId: invite.id }, port)).ok, false)
    const audits = must(await service.from('platform_admin_audit_log').select('id').eq('request_id', request.requestId), 'fixture replay audit'); assert.equal(audits.length, 1)
  })
  await check('real Auth unban persists intent, opens only fixture account, and is not replayed', async () => {
    const before = must(await service.auth.admin.getUserById(owner.id), 'read synthetic owner').user
    must(await service.auth.admin.updateUserById(owner.id, { ban_duration: '1h' }), 'ban synthetic owner')
    const blocked = client(); assert.ok((await blocked.auth.signInWithPassword({ email: owner.email, password })).error)
    let calls = 0
    const rpc = service.rpc.bind(service) as unknown as PlatformAccountsRpc
    const observed = createPlatformAdminTenantAccountsPort(rpc, async userId => {
      calls++
      const pending = must(await service.from('platform_account_unlocks').select('status').eq('user_id', userId).single(), 'durable intent before Auth')
      assert.equal(pending.status, 'pending')
      return (await service.auth.admin.updateUserById(userId, { ban_duration: 'none' })).error ? 'rejected' : 'accepted'
    })
    const request = { ...input(), kind: 'auth_unban', targetId: owner.id, confirmation: PLATFORM_UNBAN_CONFIRMATION }
    const result = await activatePlatformTenantAccount(actor, request, observed); assert.ok(result.ok); assert.equal(result.value.status, 'completed')
    assert.equal((await activatePlatformTenantAccount(actor, request, observed)).ok, true); assert.equal(calls, 1)
    await signIn(owner.email)
    const after = must(await service.auth.admin.getUserById(owner.id), 'read unbanned fixture').user
    assert.equal(after.email_confirmed_at, before.email_confirmed_at); assert.deepEqual(after.user_metadata, before.user_metadata)
    assert.equal((await activatePlatformTenantAccount(actor, { ...request, requestId: randomUUID(), targetId: outsider.id }, observed)).ok, false)
  })
  await check('unknown Auth result stays pending and reconciliation does not repeat API', async () => {
    must(await service.auth.admin.updateUserById(staff.id, { ban_duration: '1h' }), 'ban synthetic staff')
    let calls = 0
    const observed = createPlatformAdminTenantAccountsPort(service.rpc.bind(service) as unknown as PlatformAccountsRpc, async () => { calls++; return 'uncertain' })
    const request = { ...input(), kind: 'auth_unban', targetId: staff.id, confirmation: PLATFORM_UNBAN_CONFIRMATION }
    const result = await activatePlatformTenantAccount(actor, request, observed); assert.ok(result.ok); assert.equal(result.value.status, 'pending')
    assert.equal((await activatePlatformTenantAccount(actor, { ...request, requestId: randomUUID() }, observed)).ok, false)
    const reconcile = { restaurantId, requestId: request.requestId, actorUserId: admin.id, actorRole: actor.role }
    const pending = await observed.reconcileUnban(reconcile); assert.ok(pending.ok); assert.equal(pending.value.status, 'pending')
    must(await service.auth.admin.updateUserById(staff.id, { ban_duration: 'none' }), 'resolve only synthetic uncertain fixture')
    const completed = await observed.reconcileUnban(reconcile); assert.ok(completed.ok); assert.equal(completed.value.status, 'completed'); assert.equal(calls, 1)
  })
  console.log(JSON.stringify({ project: DEV, runId, checks, result: 'PASS', fixtureTenantIds: tenants }))
}
main().catch(error => { console.error(`FAIL ${error instanceof Error ? error.message : 'runtime_test_failed'}`); process.exitCode = 1 }).finally(async () => {
  const failures: string[] = []
  for (const session of sessions) if ((await session.auth.signOut()).error) failures.push('session_signout')
  if (adminId && (await service.from('platform_admin_users').update({ status: 'revoked' }).eq('user_id', adminId)).error) failures.push('admin_revoke')
  for (const tenantId of tenants) {
    if ((await service.from('restaurant_members').update({ status: 'disabled' }).eq('restaurant_id', tenantId)).error) failures.push('members_disable')
    if ((await service.from('restaurants').update({ deleted_at: new Date().toISOString() }).eq('id', tenantId)).error) failures.push('tenant_soft_delete')
  }
  for (const userId of users) if ((await service.auth.admin.updateUserById(userId, { ban_duration: '876000h' })).error) failures.push('fixture_user_disable')
  console.log(JSON.stringify({ fixtureCleanup: failures.length ? 'FAILED' : 'PASS', retainedForAudit: true, syntheticUsers: users.length, syntheticTenants: tenants.length, failures }))
  if (failures.length) process.exitCode = 1
})
