import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(new URL(
  '../supabase/migrations/20260802020000_customer_favorites_guest_claims.sql',
  import.meta.url,
), 'utf8')

test('favorites and guest claim audit are isolated behind the service role', () => {
  for (const table of ['customer_favorites', 'customer_guest_claims']) {
    assert.match(migration, new RegExp(`create table if not exists public\\.${table}`))
    assert.match(migration, new RegExp(`alter table public\\.${table} force row level security`))
    assert.match(migration, new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated`))
  }
  assert.doesNotMatch(migration, /grant (?:select|insert|update|delete|execute)[^;]*\bto (?:anon|authenticated)\b/i)
})
test('favorite writes validate restaurant ownership and stay idempotent', () => {
  assert.match(migration, /unique \(customer_id, restaurant_id, menu_item_id\)/)
  assert.match(migration, /category\.restaurant_id = p_restaurant_id/)
  assert.match(migration, /item\.is_available = true/)
  assert.match(migration, /on conflict \(customer_id, restaurant_id, menu_item_id\) do nothing/)
  assert.match(migration, /grant execute on function public\.put_customer_favorites[\s\S]*to service_role/)
})

test('guest order claiming accepts only an active QR table session and is replay safe', () => {
  const claim = migration.slice(migration.indexOf('create or replace function public.claim_active_customer_guest_orders'))
  assert.match(claim, /token\.revoked_at is null/)
  assert.match(claim, /session\.closed_at is null/)
  assert.match(claim, /pg_advisory_xact_lock/)
  assert.match(claim, /where claim\.request_id = p_request_id/)
  assert.match(claim, /customer_order\.restaurant_id = p_restaurant_id/)
  assert.match(claim, /customer_order\.table_session_id = v_table_session_id/)
  assert.match(claim, /customer_order\.session_id = p_guest_session_id/)
  assert.match(claim, /customer_order\.customer_id is null/)
  assert.match(claim, /guest orders already belong to another customer/)
})
