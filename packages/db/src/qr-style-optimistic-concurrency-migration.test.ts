import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql = readFileSync(
  new URL('../supabase/migrations/20260729010000_qr_style_optimistic_concurrency.sql', import.meta.url),
  'utf8',
)
const generatedTypes = readFileSync(new URL('./types.gen.ts', import.meta.url), 'utf8')
const readModelContract = readFileSync(new URL('./dashboard-feature-read-model-contract.ts', import.meta.url), 'utf8')

test('QR style writer uses a nonnegative revision and one atomic compare-and-swap update', () => {
  assert.match(sql, /add column if not exists qr_style_revision bigint not null default 0/i)
  assert.match(sql, /check \(qr_style_revision >= 0\)/i)
  assert.match(sql, /restaurant\.qr_style_revision = p_expected_revision/i)
  assert.match(sql, /qr_style_revision = restaurant\.qr_style_revision \+ 1/i)
  assert.match(sql, /return query select 'conflict'::text, v_revision, v_style/i)
  assert.match(sql, /return query select 'saved'::text, v_revision, v_style/i)
})

test('QR style compare-and-swap stays service-role-only and returns authoritative conflict state', () => {
  assert.match(sql, /security definer/i)
  assert.match(sql, /set search_path = public, pg_temp/i)
  assert.match(sql, /revoke all on function public\.patch_restaurant_qr_style\(uuid, jsonb, bigint\) from public, anon, authenticated/i)
  assert.match(sql, /grant execute on function public\.patch_restaurant_qr_style\(uuid, jsonb, bigint\) to service_role/i)
  assert.match(sql, /select restaurant\.qr_style_revision, restaurant\.settings -> 'qr_style'/i)
})

test('generated database contract includes the QR revision and three-argument RPC result', () => {
  assert.match(generatedTypes, /qr_style_revision: number/)
  assert.match(generatedTypes, /patch_restaurant_qr_style: \{[\s\S]*p_expected_revision: number[\s\S]*outcome: string[\s\S]*revision: number[\s\S]*style: Json/)
  assert.match(readModelContract, /'settings', 'qr_style_revision'/)
})
