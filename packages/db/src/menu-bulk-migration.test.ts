import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
const migration = readFileSync(new URL('../supabase/migrations/20260917120000_menu_bulk_edit.sql', import.meta.url), 'utf8')
test('bulk operation history and RPC stay behind the trusted actor boundary', () => {
  assert.match(migration, /alter table public\.menu_bulk_operations enable row level security/)
  assert.match(migration, /revoke all on public\.menu_bulk_operations from public, anon, authenticated/)
  assert.match(migration, /revoke all on function public\.execute_menu_bulk\([^;]+from public, anon, authenticated/)
  assert.match(migration, /auth\.role\(\) is distinct from 'service_role'/)
  assert.match(migration, /r\.owner_id = p_actor_id/)
  assert.match(migration, /m\.permissions \? 'menu'/)
  assert.match(migration, /m\.user_id = p_actor_id/)
  assert.doesNotMatch(migration, /update public\.orders|delete from public\.orders|update public\.billing_/i)
})
test('bulk writes serialize retries and validate every row before the write loop', () => {
  assert.match(migration, /unique \(restaurant_id, request_id\)/)
  assert.match(migration, /unique \(undo_of\)/)
  assert.match(migration, /pg_advisory_xact_lock/)
  assert.match(migration, /v_existing\.request_payload <> v_payload/)
  assert.match(migration, /for update of i/)
  assert.ok(migration.indexOf('jsonb_array_length(v_conflicts) > 0') < migration.indexOf('update public.menu_items set'))
  assert.match(migration, /v_item\.updated_at is distinct from/)
})
