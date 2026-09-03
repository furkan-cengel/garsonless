import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql = readFileSync(
  new URL('../supabase/migrations/20260901010000_subscription_checkout_pending_projection.sql', import.meta.url),
  'utf8',
)

test('pending checkout projection ignores abandoned sessions older than the latest success', () => {
  assert.match(sql, /pending\.status = 'awaiting_callback'/)
  assert.match(sql, /pending\.updated_at >= now\(\) - interval '24 hours'/)
  assert.match(sql, /completed\.status = 'succeeded'/)
  assert.match(sql, /coalesce\(completed\.completed_at, completed\.updated_at\) > pending\.created_at/)
  assert.match(sql, /jsonb_set\([\s\S]*\{attention,hasPendingCheckout\}/)
})

test('pending checkout projection preserves the service-role-only security boundary', () => {
  assert.match(sql, /security definer/)
  assert.match(sql, /set search_path = public, pg_temp/)
  assert.match(sql, /revoke all on function public\.read_subscription_billing_settings\(uuid\)[\s\S]*from public, anon, authenticated/)
  assert.match(sql, /grant execute on function public\.read_subscription_billing_settings\(uuid\)[\s\S]*to service_role/)
  assert.doesNotMatch(sql, /delete from|update public\.billing_provider_operations/)
})
