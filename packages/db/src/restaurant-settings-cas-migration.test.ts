import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(
  new URL('../supabase/migrations/20260731090000_restaurant_settings_patch_cas.sql', import.meta.url),
  'utf8',
)
const adapter = readFileSync(new URL('./restaurant-application-port.ts', import.meta.url), 'utf8')
const settingsAdapter = adapter.slice(0, adapter.indexOf('export function createStandRequestPort'))

test('settings CAS operation log is tenant-scoped, idempotent and client-inaccessible', () => {
  assert.match(migration, /primary key \(restaurant_id, request_id\)/i)
  assert.match(migration, /enable row level security/i)
  assert.match(migration, /revoke all on table public\.restaurant_settings_patch_operations from public, anon, authenticated/i)
  assert.match(migration, /grant select, insert on table public\.restaurant_settings_patch_operations to service_role/i)
  assert.match(migration, /v_operation\.patch <> p_patch or v_operation\.expected_states <> v_expected_states/i)
  assert.match(migration, /settings_patch_idempotency_conflict/i)
})

test('settings CAS locks one restaurant while comparing only patched top-level keys', () => {
  const lock = migration.indexOf('for update;')
  const comparison = migration.indexOf('(v_current ? v_key) <> (p_expected_settings ? v_key)')
  const write = migration.indexOf('set settings = v_current')
  assert.ok(lock > 0 && comparison > lock && write > comparison)
  assert.match(migration, /for v_key in select jsonb_object_keys\(p_patch\)/i)
  assert.match(migration, /v_current := v_current \|\| p_patch/i)
  assert.match(migration, /v_conflict_keys := v_conflict_keys \|\| to_jsonb\(v_key\)/i)
  assert.match(migration, /v_current -> v_key\) is not distinct from \(p_patch -> v_key\)/i)
  assert.match(migration, /elsif v_desired_already_current then[\s\S]*'idempotent', true/i)
})

test('settings RPC returns explicit saved, conflict and replay outcomes', () => {
  assert.match(migration, /'outcome', 'saved'/)
  assert.match(migration, /'outcome', 'conflict'/)
  assert.match(migration, /jsonb_set\(v_operation\.result, '\{idempotent\}', 'true'::jsonb/i)
  assert.match(migration, /grant execute on function public\.patch_restaurant_settings_cas\(uuid, jsonb, jsonb, uuid\)\s+to service_role/i)
  assert.doesNotMatch(migration, /drop function[^;]*patch_restaurant_settings_atomic/i)
})

test('database adapter sends the full CAS contract and hides infrastructure errors', () => {
  assert.match(settingsAdapter, /p_expected_settings: input\.expectedSettings as Json/)
  assert.match(settingsAdapter, /p_request_id: input\.requestId/)
  assert.match(settingsAdapter, /rpc\('patch_restaurant_settings_cas'/)
  assert.match(settingsAdapter, /Settings request conflicts with an earlier attempt/)
  assert.match(settingsAdapter, /Settings could not be saved/)
  assert.doesNotMatch(settingsAdapter, /return err\(error\.message\)/)
})
