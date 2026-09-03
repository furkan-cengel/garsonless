import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(
  new URL('../supabase/migrations/20260901020000_subscription_checkout_recovery.sql', import.meta.url),
  'utf8',
)

test('checkout recovery migration adds leased expiry state without deleting audit rows', () => {
  for (const column of [
    'provider_checkout_expires_at', 'recovery_next_at', 'recovery_attempts',
    'recovery_locked_at', 'recovery_locked_by',
  ]) assert.match(migration, new RegExp(`add column ${column}`))
  assert.match(migration, /'requires_reconciliation', 'expired'/)
  assert.doesNotMatch(migration, /delete\s+from\s+public\.billing_provider_operations/i)
})

test('checkout recovery claims use skip locked and keep all RPCs service-role-only', () => {
  assert.match(migration, /for update skip locked/)
  assert.match(migration, /create function public\.claim_subscription_checkout_recovery_operation/)
  assert.match(migration, /create function public\.claim_subscription_checkout_recovery/)
  assert.match(migration, /security definer[\s\S]*set search_path = public, pg_temp/)
  assert.match(migration, /grant execute on function public\.claim_subscription_checkout_recovery\(text, integer, integer\) to service_role/)
  assert.doesNotMatch(migration, /grant execute[\s\S]*to authenticated/)
})

test('pending projection ignores expired and superseded checkout sessions', () => {
  assert.match(migration, /pending\.provider_checkout_expires_at > clock_timestamp\(\)/)
  assert.match(migration, /completed\.status = 'succeeded'/)
  assert.match(migration, /coalesce\(completed\.completed_at, completed\.updated_at\) > pending\.created_at/)
})
