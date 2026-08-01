import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(
  new URL('../supabase/migrations/20260731100000_payment_credential_encrypted_vault.sql', import.meta.url),
  'utf8',
)

test('vault is service-role-only and stores a versioned encrypted envelope', () => {
  assert.match(migration, /create table public\.payment_credential_vaults/)
  assert.match(migration, /encrypted_payload jsonb not null/)
  assert.match(migration, /key_version text not null/)
  assert.match(migration, /enable row level security/)
  assert.match(migration, /revoke all on table public\.payment_credential_vaults from public, anon, authenticated/)
  assert.doesNotMatch(migration, /create policy[\s\S]*payment_credential_vaults/i)
})

test('vault writes atomically retire tenant plaintext and are request-id idempotent', () => {
  assert.match(migration, /pg_advisory_xact_lock\(hashtextextended\(p_request_id::text, 0\)\)/)
  assert.match(migration, /payment_credential_request_conflict/)
  assert.match(migration, /delete from public\.payment_credentials where restaurant_id = p_restaurant_id/)
  assert.match(migration, /payment_credential_write_operations/)
  assert.match(migration, /payment_credential_rotation_audit/)
})

test('expand-phase status projection covers encrypted and not-yet-rotated tenants', () => {
  assert.match(migration, /create view public\.payment_credential_status/)
  assert.match(migration, /from public\.payment_credential_vaults v[\s\S]*union all[\s\S]*from public\.payment_credentials l/)
  assert.match(migration, /revoke all on table public\.payment_credential_status from public, anon, authenticated/)
  assert.match(migration, /grant select on table public\.payment_credential_status to service_role/)
})

test('write RPCs verify the trusted owner and cannot be replayed by authenticated clients', () => {
  assert.match(migration, /r\.owner_id = p_actor_user_id/)
  assert.match(migration, /r\.deleted_at is null/)
  assert.match(migration, /revoke all on function public\.save_payment_credential_vault[\s\S]*from public, anon, authenticated/)
  assert.match(migration, /grant execute on function public\.save_payment_credential_vault[\s\S]*to service_role/)
})
