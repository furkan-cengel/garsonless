import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(
  new URL('../supabase/migrations/20260903054000_table_order_item_transfer_lint_pragma.sql', import.meta.url),
  'utf8',
)

test('item-transfer temp-table lint metadata is an append-only targeted patch', () => {
  assert.match(migration, /pg_get_functiondef\(v_signature\)/)
  assert.match(migration, /public\.transfer_table_order_items\(uuid,uuid,uuid,jsonb,uuid,uuid\)/)
  assert.match(migration, /create temporary table item_transfer_selection/)
  assert.match(migration, /PRAGMA:TABLE: item_transfer_selection/)
  assert.match(migration, /order_id uuid, line_index integer, quantity integer/)
  assert.match(migration, /temp-table shape is unknown/)
})

test('lint annotation has no runtime extension dependency and preserves service-only access', () => {
  assert.doesNotMatch(migration, /plpgsql_check_pragma\s*\(/)
  assert.doesNotMatch(migration, /disable:check/i)
  assert.match(migration, /revoke all on function public\.transfer_table_order_items[\s\S]*from public, anon, authenticated/)
  assert.match(migration, /grant execute on function public\.transfer_table_order_items[\s\S]*to service_role/)
})
