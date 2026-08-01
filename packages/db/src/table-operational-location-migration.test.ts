import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql = readFileSync(
  new URL('../supabase/migrations/20260728020000_table_operational_locations.sql', import.meta.url),
  'utf8',
)

test('operational table locations are tenant-scoped, bounded and indexed', () => {
  assert.match(sql, /add column if not exists floor_label text/i)
  assert.match(sql, /add column if not exists area_label text/i)
  assert.match(sql, /char_length\(floor_label\) between 1 and 40/i)
  assert.match(sql, /char_length\(area_label\) between 1 and 40/i)
  assert.match(sql, /on public\.tables \(restaurant_id, floor_label, area_label\)/i)
  assert.match(sql, /where deleted_at is null/i)
})

test('located create reuses the locked plan-limit writer and enriches the same tenant row atomically', () => {
  assert.match(sql, /security definer[\s\S]*set search_path = public, pg_temp/i)
  assert.match(sql, /from public\.create_table_with_plan_limit\(p_restaurant_id, p_label\)/i)
  assert.match(sql, /where id = v_result\.table_id[\s\S]*and restaurant_id = p_restaurant_id/i)
  assert.match(sql, /revoke all on function public\.create_located_table_with_plan_limit[\s\S]*from public, anon, authenticated/i)
  assert.match(sql, /grant execute on function public\.create_located_table_with_plan_limit[\s\S]*to service_role/i)
})
