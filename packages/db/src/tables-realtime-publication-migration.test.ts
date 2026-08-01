import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const migration = readFileSync(fileURLToPath(new URL('../supabase/migrations/20260729030000_tables_realtime_publication.sql', import.meta.url)), 'utf8')

test('tables publication migration is idempotent and does not publish the service-only request ledger', () => {
  assert.match(migration, /pg_publication_tables/)
  assert.match(migration, /alter publication supabase_realtime add table public\.tables/)
  assert.doesNotMatch(migration, /add table public\.table_layout_requests/)
  assert.doesNotMatch(migration, /add table public\.restaurants/)
})
