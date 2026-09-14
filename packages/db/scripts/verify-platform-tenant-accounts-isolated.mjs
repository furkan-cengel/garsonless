// No network, credentials, existing users or persistent database are used.
// PGLITE_MODULE_PATH points to a separately installed @electric-sql/pglite dist/index.js.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
if (!process.env.PGLITE_MODULE_PATH) throw new Error('Set PGLITE_MODULE_PATH to an isolated PGlite installation')
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE_PATH).href)
const db = new PGlite()
const owner = randomUUID(), admin = randomUUID(), staff = randomUUID(), outsider = randomUUID(), invited = randomUUID()
const tenant = randomUUID(), otherTenant = randomUUID(), member = randomUUID(), invite = randomUUID()
const reason = 'Isolated account management verification'
let checks = 0
async function check(name, run) { await run(); checks++; console.log(`PASS ${name}`) }
async function rpc(name, params) {
  return (await db.query(`select public.${name}(${params.map((_, index) => `$${index + 1}`).join(',')}) as result`, params)).rows[0].result
}
const trusted = () => [tenant, admin, 'superadmin', reason, randomUUID()]
try {
  // Minimal schemas mirror the prerequisite columns. The actual foundation and feature migrations execute unchanged.
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create table auth.users(id uuid primary key, email text, phone text, raw_user_meta_data jsonb default '{}', created_at timestamptz default now(), last_sign_in_at timestamptz, email_confirmed_at timestamptz, banned_until timestamptz, deleted_at timestamptz);
    create table public.restaurants(id uuid primary key, owner_id uuid references auth.users(id), deleted_at timestamptz);
    create table public.restaurant_members(id uuid primary key, restaurant_id uuid references public.restaurants(id), user_id uuid references auth.users(id), email text, status text, permissions jsonb, invited_at timestamptz default now(), accepted_at timestamptz);
    create table public.billing_customers(restaurant_id uuid unique references public.restaurants(id), legal_name text, contact_email text, contact_name text, contact_surname text, gsm_number text, identity_number text, billing_address jsonb);
  `)
  for (const file of ['20260722090000_platform_admin_foundation.sql', '20260913120000_platform_tenant_accounts.sql']) {
    await db.exec(readFileSync(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'))
  }
  for (const [user, email] of [[owner, 'owner@example.test'], [admin, 'admin@example.test'], [staff, 'staff@example.test'], [outsider, 'outsider@example.test'], [invited, 'invited@example.test']]) {
    await db.query('insert into auth.users(id,email) values($1,$2)', [user, email])
  }
  await db.query("insert into public.platform_admin_users(user_id,role,status,activated_at) values($1,'superadmin','active',now())", [admin])
  await db.query('insert into public.restaurants(id,owner_id) values($1,$2),($3,$4)', [tenant, owner, otherTenant, outsider])
  await db.query("insert into public.restaurant_members(id,restaurant_id,user_id,email,status,permissions,accepted_at) values($1,$2,$3,'staff@example.test','disabled','[\"orders\"]',now()),($4,$2,$5,'invited@example.test','invited','[]',null)", [member, tenant, staff, invite, invited])
  await db.query("insert into public.billing_customers(restaurant_id,legal_name,contact_email,billing_address) values($1,'Test Company','billing@example.test','{\"city\":\"İstanbul\",\"secret\":\"do-not-return\"}')", [tenant])

  await check('migration compiles and reveal contains only scoped owner, staff, invitation and closed billing fields', async () => {
    const result = await rpc('reveal_platform_admin_tenant_accounts', trusted())
    assert.equal(result.accounts.length, 3)
    assert.equal(result.accounts[0].email, 'owner@example.test')
    assert.equal(result.billing.email, 'billing@example.test')
    assert.doesNotMatch(JSON.stringify(result), /outsider|do-not-return/)
    const audits = (await db.query('select before_state,after_state from public.platform_admin_audit_log')).rows
    assert.doesNotMatch(JSON.stringify(audits), /example\.test/)
  })
  await check('spoofed and suspended admin identities are rejected', async () => {
    await assert.rejects(rpc('reveal_platform_admin_tenant_accounts', [tenant, owner, 'superadmin', reason, randomUUID()]), /not_authorized/)
    await assert.rejects(rpc('reveal_platform_admin_tenant_accounts', [tenant, admin, 'support', reason, randomUUID()]), /not_authorized/)
    await db.query("update public.platform_admin_users set status='suspended' where user_id=$1", [admin])
    await assert.rejects(rpc('reveal_platform_admin_tenant_accounts', trusted()), /not_authorized/)
    await db.query("update public.platform_admin_users set status='active' where user_id=$1", [admin])
  })
  await check('anonymous and authenticated roles cannot execute privileged RPCs or read the unlock ledger', async () => {
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`)
      try {
        await assert.rejects(rpc('reveal_platform_admin_tenant_accounts', trusted()), /permission denied/)
        await assert.rejects(db.query('select * from public.platform_account_unlocks'), /permission denied/)
      } finally { await db.exec('reset role') }
    }
  })
  await check('member activation preserves permissions, is audited once and cannot accept invitations or cross tenants', async () => {
    const args = [tenant, member, admin, 'superadmin', reason, randomUUID()]
    assert.equal((await rpc('reactivate_platform_admin_tenant_member', args)).status, 'completed')
    assert.equal((await rpc('reactivate_platform_admin_tenant_member', args)).status, 'completed')
    assert.deepEqual((await db.query('select status,permissions from public.restaurant_members where id=$1', [member])).rows[0], { status: 'active', permissions: ['orders'] })
    assert.equal((await db.query("select count(*)::int as count from public.platform_admin_audit_log where action='tenant.member.reactivate'")).rows[0].count, 1)
    await assert.rejects(rpc('reactivate_platform_admin_tenant_member', [otherTenant, member, admin, 'superadmin', reason, randomUUID()]), /not_actionable/)
    await assert.rejects(rpc('reactivate_platform_admin_tenant_member', [tenant, invite, admin, 'superadmin', reason, randomUUID()]), /not_actionable/)
  })
  await check('Auth unban scope rejects unrelated users and protected platform administrators', async () => {
    await assert.rejects(rpc('prepare_platform_admin_user_unban', [tenant, outsider, admin, 'superadmin', reason, randomUUID()]), /scope_mismatch/)
    await db.query('update public.restaurants set owner_id=$1 where id=$2', [admin, otherTenant])
    await assert.rejects(rpc('prepare_platform_admin_user_unban', [otherTenant, admin, admin, 'superadmin', reason, randomUUID()]), /protected/)
  })
  await check('unban preparation is idempotent; pending results block blind retries and are visible', async () => {
    await db.query("update auth.users set banned_until=now()+interval '1 day' where id=$1", [owner])
    const request = randomUUID(), args = [tenant, owner, admin, 'superadmin', reason, request]
    assert.equal((await rpc('prepare_platform_admin_user_unban', args)).execute, true)
    assert.equal((await rpc('prepare_platform_admin_user_unban', args)).execute, false)
    await assert.rejects(rpc('prepare_platform_admin_user_unban', [tenant, owner, admin, 'superadmin', reason, randomUUID()]), /unban_pending/)
    assert.equal((await rpc('reveal_platform_admin_tenant_accounts', trusted())).accounts[0].pendingUnlockRequestId, request)
    assert.equal((await rpc('finish_platform_admin_user_unban', [tenant, admin, 'superadmin', request, false])).status, 'pending')
    await assert.rejects(rpc('finish_platform_admin_user_unban', [otherTenant, admin, 'superadmin', request, false]), /not_found/)
    // Simulated Auth Admin API persistence, only in this throwaway database.
    await db.query('update auth.users set banned_until=null where id=$1', [owner])
    assert.equal((await rpc('finish_platform_admin_user_unban', [tenant, admin, 'superadmin', request, false])).status, 'completed')
    assert.equal((await rpc('finish_platform_admin_user_unban', [tenant, admin, 'superadmin', request, false])).status, 'completed')
    assert.equal((await db.query("select count(*)::int as count from public.platform_admin_audit_log where action='tenant.account.unban_resolved'")).rows[0].count, 1)
    assert.equal((await db.query('select email_confirmed_at from auth.users where id=$1', [owner])).rows[0].email_confirmed_at, null)
  })
  await check('deleted tenants and invalid reasons are rejected; audits remain append-only', async () => {
    await assert.rejects(rpc('reveal_platform_admin_tenant_accounts', [tenant, admin, 'superadmin', 'short', randomUUID()]), /invalid_input/)
    await db.query('update public.restaurants set deleted_at=now() where id=$1', [tenant])
    await assert.rejects(rpc('reveal_platform_admin_tenant_accounts', trusted()), /not_found/)
    await assert.rejects(db.query("update public.platform_admin_audit_log set reason='Tampered audit reason'"), /append_only/)
  })
  console.log(`PASS ${checks} isolated PostgreSQL checks (no live database used)`)
} finally { await db.close() }
