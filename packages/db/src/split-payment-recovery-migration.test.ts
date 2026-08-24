import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const directory = fileURLToPath(new URL('.', import.meta.url))
const migration = readFileSync(`${directory}/../supabase/migrations/20260822050000_split_payment_recovery.sql`, 'utf8')

test('unstarted split recovery is tenant scoped and refuses provider-token shares', () => {
  assert.match(migration, /void_unstarted_split_share_atomic/)
  assert.match(migration, /id = p_share_id and restaurant_id = p_restaurant_id/)
  assert.match(migration, /payment_share_tokens token where token\.share_id = v_share\.id/)
  assert.match(migration, /return 'provider_pending'/)
  assert.match(migration, /revoke all on function public\.void_unstarted_split_share_atomic\(uuid,uuid\)[\s\S]*from public, anon, authenticated/)
  assert.match(migration, /grant execute on function public\.void_unstarted_split_share_atomic\(uuid,uuid\)[\s\S]*to service_role/)
})

test('verified provider failure is bound to the exact stored token hash', () => {
  assert.match(migration, /void_verified_failed_split_share_atomic/)
  assert.match(migration, /extensions\.digest\(token\.token, 'sha256'\)/)
  assert.match(migration, /provider_mapping_mismatch/)
  assert.doesNotMatch(migration, /delete from public\.payment_share_tokens/)
})

test('settlement bundle exposes provider state without exposing raw tokens', () => {
  const bundle = migration.slice(
    migration.indexOf('create or replace function public.read_session_settlement_bundle'),
    migration.indexOf('revoke all on function public.read_session_settlement_bundle'),
  )
  assert.match(bundle, /checkout_reserved_until/)
  assert.match(bundle, /provider_token_attached/)
  assert.doesNotMatch(bundle, /token\.token/)
})
