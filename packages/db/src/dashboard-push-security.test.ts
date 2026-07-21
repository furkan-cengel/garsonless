import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(new URL(
  '../supabase/migrations/20260721010000_dashboard_push_subscriptions.sql',
  import.meta.url,
), 'utf8')

test('push subscription rows are own-user and tenant scoped under RLS', () => {
  assert.match(migration, /alter table public\.dashboard_push_subscriptions enable row level security/)
  assert.match(migration, /user_id = auth\.uid\(\)/)
  assert.match(migration, /public\.has_restaurant_access\(restaurant_id\)/)
  assert.match(migration, /unique \(restaurant_id, user_id, endpoint_hash\)/)
})

test('delivery diagnostics remain service-role only and event-idempotent', () => {
  assert.match(migration, /primary key \(outbox_id, subscription_id\)/)
  assert.match(migration, /revoke all on public\.dashboard_push_deliveries from public, anon, authenticated/)
  assert.doesNotMatch(migration, /grant .*dashboard_push_deliveries to authenticated/)
})
