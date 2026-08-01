import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const sql = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260728030000_table_transfer_history_metadata.sql'),
  'utf8',
)

test('transfer history exposes immutable audit metadata from the operation row', () => {
  for (const field of [
    'request_id',
    'source_session_closed',
    'target_session_created',
    'created_by',
    'undone_by',
    'undone_at',
    'lock_reason',
  ]) {
    assert.match(sql, new RegExp(`operation\\.${field}`))
  }
  assert.match(sql, /count\(transfer_order\.order_id\)/)
  assert.match(sql, /where operation\.restaurant_id = p_restaurant_id/)
  assert.match(sql, /order by operation\.created_at desc/)
})

test('expanded history RPC remains service-role-only', () => {
  assert.match(sql, /security definer/)
  assert.match(sql, /set search_path = public, pg_temp/)
  assert.match(sql, /revoke all on function public\.list_table_transfer_history[\s\S]+from public, anon, authenticated/)
  assert.match(sql, /grant execute on function public\.list_table_transfer_history[\s\S]+to service_role/)
})
