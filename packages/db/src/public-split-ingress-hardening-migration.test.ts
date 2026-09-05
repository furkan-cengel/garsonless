import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(
  new URL('../supabase/migrations/20260903050000_public_split_ingress_hardening.sql', import.meta.url),
  'utf8',
)
const adapter = readFileSync(new URL('./split-command-port.ts', import.meta.url), 'utf8')

test('split declarations have a durable tenant-scoped idempotency key', () => {
  assert.match(migration, /add column if not exists request_id uuid/)
  assert.match(migration, /add column if not exists request_fingerprint text/)
  assert.match(migration, /on public\.payment_shares\(restaurant_id, request_id\)/)
  assert.match(migration, /share\.request_id = p_request_id[\s\S]*?'idempotent', true/)
  assert.match(migration, /split_request_id_conflict/)
  assert.match(migration, /request_fingerprint is distinct from p_request_fingerprint/)
})

test('split declarations serialize and cap unresolved intents', () => {
  assert.match(migration, /from public\.table_sessions session[\s\S]*?for update/)
  assert.match(migration, /share\.status = 'declared'/)
  assert.match(migration, /split_active_intent_limit/)
  assert.match(migration, /jsonb_array_length\(p_assigned_items\) > 50/)
})

test('guarded split declaration RPC is service-role only', () => {
  assert.match(migration, /security definer[\s\S]*?set search_path = public, pg_temp/)
  assert.match(migration, /revoke all on function public\.create_split_share_guarded\([\s\S]*?from public, anon, authenticated/)
  assert.match(migration, /grant execute on function public\.create_split_share_guarded\([\s\S]*?to service_role/)
})

test('split application adapter consumes the existing DB-backed rate journal', () => {
  assert.match(adapter, /consume_public_order_rate_limit/)
  assert.match(adapter, /p_key_hash: `split:\$\{input\.keyHash\}`/)
  assert.match(adapter, /Çok fazla pay denemesi/)
})
