import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(
  new URL('../supabase/migrations/20260729060000_qr_rotation_idempotency.sql', import.meta.url),
  'utf8',
)

test('QR rotation records a globally unique request identity', () => {
  assert.match(migration, /rotation_request_id uuid/)
  assert.match(migration, /unique index[\s\S]*rotation_request_id/)
  assert.match(migration, /p_request_id uuid/)
})

test('QR rotation serializes retries and rejects request payload conflicts', () => {
  assert.match(migration, /pg_advisory_xact_lock/)
  assert.match(migration, /qr_rotation_request_conflict/)
  assert.match(migration, /return v_existing\.token/)
})

test('QR rotation remains service-role only', () => {
  assert.match(migration, /revoke all on function public\.rotate_table_qr_token[\s\S]*from public, anon, authenticated/)
  assert.match(migration, /grant execute on function public\.rotate_table_qr_token[\s\S]*to service_role/)
})
