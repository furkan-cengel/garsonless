import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql = readFileSync(
  new URL('../supabase/migrations/20261010100000_reorder_menu_items.sql', import.meta.url),
  'utf8',
)

test('item reorder is service-role-only security definer with a pinned search path', () => {
  assert.match(sql, /security definer/i)
  assert.match(sql, /set search_path = public, pg_temp/i)
  assert.match(sql, /if auth\.role\(\) <> 'service_role' then/i)
  assert.match(sql, /revoke all on function public\.reorder_menu_items\(uuid, uuid, uuid\[\]\) from public, anon, authenticated/i)
  assert.match(sql, /grant execute on function public\.reorder_menu_items\(uuid, uuid, uuid\[\]\) to service_role;/i)
  assert.doesNotMatch(sql, /to authenticated/i)
})

test('item reorder is tenant-scoped and refuses stale or partial lists', () => {
  assert.match(sql, /category\.restaurant_id = p_restaurant_id/i)
  assert.match(sql, /count\(distinct id\)/i)
  assert.match(sql, /for update;/i)
  assert.match(sql, /v_live <> v_expected or v_matched <> v_expected/i)
  assert.match(sql, /set position = ordered\.position - 1/i)
  assert.match(sql, /item\.category_id = p_category_id/i)
})
