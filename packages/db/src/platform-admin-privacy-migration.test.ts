import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const sql = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20260722200000_platform_tenant_privacy_operations.sql'), 'utf8')
const scopeFix = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20260722201000_platform_tenant_privacy_erasure_scope.sql'), 'utf8')

test('privacy operations are service-only and superadmin-reverified', () => {
  assert.match(sql, /platform_tenant_privacy_operations[\s\S]*enable row level security/)
  assert.match(sql, /revoke all on table public\.platform_tenant_privacy_operations from public, anon, authenticated/)
  assert.match(sql, /v_identity\.role <> 'superadmin'/)
  assert.match(sql, /revoke all on function public\.erase_platform_admin_tenant_privacy_data[\s\S]*from public, anon, authenticated/)
})

test('export payload is transient while the audit stores only counters', () => {
  assert.match(sql, /'document', v_document/)
  assert.doesNotMatch(sql, /insert into public\.platform_tenant_privacy_operations[^;]*v_document/)
  assert.match(sql, /'summary', v_summary/)
})

test('erasure is tenant-scoped and preserves billing and operational orders', () => {
  assert.match(sql, /update public\.orders set customer_id = null/)
  assert.match(sql, /delete from public\.loyalty_transactions where restaurant_id = p_restaurant_id/)
  assert.match(sql, /delete from public\.customer_consents where restaurant_id = p_restaurant_id/)
  assert.match(sql, /not exists \(select 1 from public\.customer_restaurants/)
  assert.doesNotMatch(sql, /delete from public\.orders/)
  assert.doesNotMatch(sql, /delete from public\.billing_/)
  assert.match(sql, /'billingRecordsPreserved', true/)
})

test('request replay returns the prior evidence instead of mutating twice', () => {
  assert.match(sql, /where request_id = p_request_id/)
  assert.match(sql, /'duplicate', true/)
  assert.match(sql, /request_id uuid not null unique/)
})

test('forward fix leaves unrelated guest shares and operational messages intact', () => {
  assert.match(scopeFix, /update public\.payment_shares[\s\S]*customer_id is not null/)
  assert.match(scopeFix, /update public\.message_events[\s\S]*customer_id is not null/)
  assert.match(scopeFix, /revoke all on function public\.erase_platform_admin_tenant_privacy_data[\s\S]*anon, authenticated/)
})
