import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(
  new URL('../supabase/migrations/20260821030000_pano_realtime_invalidation_boundary.sql', import.meta.url),
  'utf8',
)
const anonReadRemoval = readFileSync(
  new URL('../supabase/migrations/20260714030000_remove_global_anon_order_reads.sql', import.meta.url),
  'utf8',
)

test('Pano invalidations expose only a minimal section-authorized projection', () => {
  assert.match(migration, /create table if not exists public\.pano_invalidations/)
  assert.match(migration, /grant select \(restaurant_id, version, source, updated_at\)/)
  assert.match(migration, /has_restaurant_section\(restaurant_id, 'pano'\)/)
  assert.match(migration, /revoke all on public\.pano_invalidations from public, anon, authenticated/)
  assert.doesNotMatch(migration, /grant (?:select|all)[\s\S]*to anon/)
})

test('every Pano source bumps one coalesced tenant version', () => {
  for (const table of ['orders', 'table_sessions', 'payment_shares', 'service_requests', 'tables']) {
    assert.match(migration, new RegExp(`'${table}'`))
  }
  assert.match(migration, /on conflict \(restaurant_id\) do update/)
  assert.match(migration, /version = public\.pano_invalidations\.version \+ 1/)
  assert.match(migration, /alter publication supabase_realtime add table public\.pano_invalidations/)
})

test('direct payment-share reads require table-section access', () => {
  assert.match(anonReadRemoval, /drop policy if exists "anon_read_payment_shares"/)
  assert.match(anonReadRemoval, /revoke select on public\.payment_shares from anon/)
  assert.match(migration, /drop policy if exists staff_read_payment_shares/)
  assert.match(migration, /has_restaurant_section\(restaurant_id, 'tables'\)/)
})
