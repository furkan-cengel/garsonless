import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const sql = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260728010000_table_transfer_request_intent.sql'),
  'utf8',
)

test('transfer request ids are bound to a canonical persisted intent', () => {
  assert.match(sql, /add column if not exists request_intent jsonb/)
  assert.match(sql, /alter column request_intent set not null/)
  assert.match(sql, /select distinct unnest\(coalesce\(p_order_ids/)
  assert.match(sql, /jsonb_agg\(canonical\.order_id::text order by canonical\.order_id\)/)
  assert.match(sql, /operation\.kind = 'account_transfer'/)
})

test('same-request races serialize before replay intent is evaluated', () => {
  const advisoryLocks = sql.match(/pg_advisory_xact_lock/g) ?? []
  const rowLocks = sql.match(/request_id = p_request_id\s+for update/g) ?? []
  assert.equal(advisoryLocks.length, 2)
  assert.equal(rowLocks.length, 2)
})

test('both transfer commands reject request-id reuse with a different intent', () => {
  const conflicts = sql.match(/table_transfer_idempotency_conflict/g) ?? []
  const intentWrites = sql.match(/request_id,request_intent,kind/g) ?? []
  assert.equal(conflicts.length, 2)
  assert.equal(intentWrites.length, 2)
  assert.match(sql, /v_op\.request_intent <> v_intent/)
})

test('intent helper and transfer RPCs remain service-role-only', () => {
  assert.match(sql, /revoke all on function public\.table_transfer_request_intent[\s\S]+from public, anon, authenticated/)
  assert.match(sql, /grant execute on function public\.table_transfer_request_intent[\s\S]+to service_role/)
  assert.match(sql, /revoke all on function public\.move_table_session[\s\S]+from public, anon, authenticated/)
})
