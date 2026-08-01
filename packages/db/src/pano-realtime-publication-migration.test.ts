import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(
  new URL('../supabase/migrations/20260730010000_pano_realtime_publication.sql', import.meta.url),
  'utf8',
)

test('Pano publishes payment and service invalidations idempotently', () => {
  assert.match(migration, /foreach table_name in array array\['payment_shares', 'service_requests'\]/)
  assert.match(migration, /pg_publication_tables/)
  assert.match(migration, /pubname = 'supabase_realtime'/)
  assert.match(migration, /alter publication supabase_realtime add table public\.%I/)
  assert.doesNotMatch(migration, /table_transfer_requests|table_layout_requests/)
})
