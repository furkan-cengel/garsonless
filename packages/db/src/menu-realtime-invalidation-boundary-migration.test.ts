import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(
  new URL('../supabase/migrations/20260822010000_menu_realtime_invalidation_boundary.sql', import.meta.url),
  'utf8',
)

test('menu invalidations expose only a minimal section-authorized projection', () => {
  assert.match(migration, /create table if not exists public\.menu_invalidations/)
  assert.match(migration, /grant select \(restaurant_id, version, source, updated_at\)/)
  assert.match(migration, /has_restaurant_section\(restaurant_id, 'menu'\)/)
  assert.match(migration, /revoke all on public\.menu_invalidations from public, anon, authenticated/)
  assert.doesNotMatch(migration, /grant (?:select|all)[\s\S]*to anon/)
})

test('all menu sources bump one coalesced tenant version', () => {
  for (const table of ['menu_categories', 'menu_items', 'menu_item_recommendations']) {
    assert.match(migration, new RegExp(`'${table}'`))
  }
  assert.match(migration, /where category\.id = v_category_id/)
  assert.match(migration, /on conflict \(restaurant_id\) do update/)
  assert.match(migration, /version = public\.menu_invalidations\.version \+ 1/)
  assert.match(migration, /alter publication supabase_realtime add table public\.menu_invalidations/)
})

test('bulk menu import is one bounded, tenant-authorized transaction command', () => {
  assert.match(migration, /create or replace function public\.import_menu_rows/)
  assert.match(migration, /jsonb_array_length\(p_rows\) > 1000/)
  assert.match(migration, /has_restaurant_section\(p_restaurant_id, 'menu'\)/)
  assert.match(migration, /pg_advisory_xact_lock/)
  assert.match(migration, /grant execute on function public\.import_menu_rows\(uuid, jsonb\) to authenticated/)
  assert.match(migration, /revoke all on function public\.import_menu_rows\(uuid, jsonb\) from public, anon/)
})
