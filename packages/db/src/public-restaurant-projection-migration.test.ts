import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(
  new URL('../supabase/migrations/20260903010000_public_restaurant_projection.sql', import.meta.url),
  'utf8',
)

test('public restaurant projection removes direct anonymous base-table access', () => {
  assert.match(migration, /drop policy if exists "anon_read_restaurants" on public\.restaurants/)
  assert.match(migration, /revoke select on table public\.restaurants from anon/)
  assert.match(migration, /create policy "members_read_restaurants"[\s\S]*to authenticated[\s\S]*has_restaurant_access\(id\)/)
})

test('public restaurant projection is a fixed-search-path allowlist', () => {
  assert.match(migration, /function public\.read_public_restaurant_by_slug\(p_slug text\)/)
  assert.match(migration, /security definer\s+set search_path = ''/)
  assert.match(migration, /grant execute on function public\.read_public_restaurant_by_slug\(text\)[\s\S]*to anon, authenticated, service_role/)
  assert.match(migration, /'contact'[\s\S]*'hours'[\s\S]*'loyalty'/)
  assert.doesNotMatch(migration, /r\.owner_id|r\.plan|r\.settings\s+as settings/)
})
