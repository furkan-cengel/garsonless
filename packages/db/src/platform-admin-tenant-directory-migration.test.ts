import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql = readFileSync(new URL('../supabase/migrations/20260722100000_platform_admin_tenant_directory.sql', import.meta.url), 'utf8')

test('tenant directory RPCs are stable, security-definer and service-role only', () => {
  assert.match(sql, /create or replace function public\.list_platform_admin_tenants/)
  assert.match(sql, /create or replace function public\.read_platform_admin_tenant/)
  assert.match(sql, /stable\s+security definer/)
  assert.match(sql, /revoke all on function public\.list_platform_admin_tenants[\s\S]+from public, anon, authenticated/)
  assert.match(sql, /grant execute on function public\.read_platform_admin_tenant\(uuid\) to service_role/)
})

test('directory inputs are closed and bounded in SQL as a second line of defense', () => {
  assert.match(sql, /char_length\(coalesce\(p_search, ''\)\) > 100/)
  assert.match(sql, /p_limit not between 1 and 50/)
  assert.match(sql, /p_offset not between 0 and 10000/)
  assert.match(sql, /p_lifecycle not in \('active', 'deleted', 'all'\)/)
  assert.match(sql, /p_subscription_status not in/)
})

test('safe projections omit PII, provider references, raw payloads and restaurant settings', () => {
  for (const forbidden of [
    "'ownerId'", "'ownerEmail'", "'contactEmail'", "'settings'", "'provider'",
    "'providerCustomerRef'", "'providerSubscriptionRef'", "'providerInvoiceRef'",
    "'failureMessage'", "'lastError'", "'payload'",
  ]) assert.doesNotMatch(sql, new RegExp(forbidden))
  assert.match(sql, /'latestInvoice'/)
  assert.match(sql, /'reconciliationCount'/)
  assert.match(sql, /'openServiceRequests'/)
})

test('directory uses active domain status semantics and deterministic paging', () => {
  assert.match(sql, /o\.status in \('pending', 'pending_approval', 'sent_to_kitchen', 'preparing', 'ready', 'served'\)/)
  assert.match(sql, /order by r\.created_at desc, r\.id desc/)
  assert.match(sql, /limit p_limit offset p_offset/)
})
