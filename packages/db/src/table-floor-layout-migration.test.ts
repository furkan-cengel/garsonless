import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql = readFileSync(
  new URL('../supabase/migrations/20260729020000_table_floor_layout.sql', import.meta.url),
  'utf8',
)
const generatedTypes = readFileSync(new URL('./types.gen.ts', import.meta.url), 'utf8')
const readModelContract = readFileSync(new URL('./dashboard-feature-read-model-contract.ts', import.meta.url), 'utf8')

test('table layout schema constrains normalized coordinates and physical table properties', () => {
  assert.match(sql, /add column if not exists layout_x_bp smallint/i)
  assert.match(sql, /layout_x_bp between 0 and 10000/i)
  assert.match(sql, /layout_y_bp between 0 and 10000/i)
  assert.match(sql, /layout_shape in \('square', 'rectangle'\)/i)
  assert.match(sql, /layout_rotation in \(0, 90\)/i)
  assert.match(sql, /seat_count between 1 and 20/i)
})

test('table layout writer locks the tenant, validates every table, and updates atomically', () => {
  assert.match(sql, /from public\.restaurants restaurant[\s\S]*for update/i)
  assert.match(sql, /for update of table_row/i)
  assert.match(sql, /table_row\.restaurant_id = p_restaurant_id/i)
  assert.match(sql, /raise exception 'table_layout_table_not_found'/i)
  assert.match(sql, /table_layout_revision = restaurant\.table_layout_revision \+ 1/i)
  assert.match(sql, /v_restaurant\.table_layout_revision <> p_expected_revision/i)
})

test('table layout request ids bind one canonical intent and exact retries return the stored result', () => {
  assert.match(sql, /primary key \(restaurant_id, request_id\)/i)
  assert.match(sql, /jsonb_agg\([\s\S]*order by parsed\.table_id/i)
  assert.match(sql, /v_existing\.request_intent <> v_intent/i)
  assert.match(sql, /raise exception 'table_layout_idempotency_conflict'/i)
  assert.match(sql, /return v_existing\.result \|\| jsonb_build_object\('idempotent', true\)/i)
})

test('table layout RPC and idempotency ledger are service-role-only', () => {
  assert.match(sql, /alter table public\.table_layout_requests enable row level security/i)
  assert.match(sql, /revoke all on table public\.table_layout_requests from public, anon, authenticated/i)
  assert.match(sql, /grant select, insert on table public\.table_layout_requests to service_role/i)
  assert.match(sql, /security definer[\s\S]*set search_path = public, pg_temp/i)
  assert.match(sql, /revoke all on function public\.save_restaurant_table_layout\(uuid,bigint,uuid,jsonb,uuid\)[\s\S]*from public, anon, authenticated/i)
  assert.match(sql, /grant execute on function public\.save_restaurant_table_layout\(uuid,bigint,uuid,jsonb,uuid\)[\s\S]*to service_role/i)
})

test('generated and pinned read contracts include the authoritative layout state', () => {
  assert.match(generatedTypes, /table_layout_initialized_at: string \| null/)
  assert.match(generatedTypes, /table_layout_revision: number/)
  assert.match(generatedTypes, /layout_x_bp: number \| null/)
  assert.match(generatedTypes, /save_restaurant_table_layout: \{[\s\S]*p_expected_revision: number[\s\S]*Returns: Json/)
  assert.match(readModelContract, /'table_layout_revision', 'table_layout_initialized_at'/)
  assert.match(readModelContract, /'layout_x_bp', 'layout_y_bp', 'layout_shape', 'layout_rotation', 'seat_count'/)
})
