import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql = readFileSync(
  new URL('../supabase/migrations/20261010110000_customer_visits_from_sessions.sql', import.meta.url),
  'utf8',
)

test('visits count distinct non-cancelled bills, counter sales as their own visit', () => {
  assert.match(sql, /count\(distinct coalesce\(table_session_id, id\)\) filter \(where status <> \\'cancelled\\'\)::int as visits/)
  assert.match(sql, /count\(distinct coalesce\(table_session_id, id\)\) filter \(where status <> 'cancelled'\)::integer as visits/)
})

test('the list patch is shape-checked, idempotent and leaves loyalty rows alone', () => {
  assert.match(sql, /raise exception 'get_restaurant_customers visit projection has unexpected shape'/)
  assert.match(sql, /if position\(new_visits in definition\) > 0 then\s+return;/)
  assert.doesNotMatch(sql, /(insert into|update|delete from) public\.loyalty_transactions/i)
})

test('the summary stays service-role-only with a pinned search path', () => {
  assert.match(sql, /security definer\s+set search_path = public, pg_temp/)
  assert.match(sql, /revoke all on function public\.get_restaurant_customer_summary\(uuid, uuid\) from public, anon, authenticated/)
  assert.match(sql, /grant execute on function public\.get_restaurant_customer_summary\(uuid, uuid\) to service_role;/)
})
