import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(
  new URL('../supabase/migrations/20260822020000_tables_realtime_invalidation_access.sql', import.meta.url),
  'utf8',
)

test('operational invalidations are readable only inside an authorized tenant section', () => {
  assert.match(migration, /drop policy if exists pano_invalidations_read/)
  assert.match(migration, /has_restaurant_section\(restaurant_id, 'pano'\)/)
  assert.match(migration, /has_restaurant_section\(restaurant_id, 'tables'\)/)
  assert.doesNotMatch(migration, /to anon|grant all/i)
})
