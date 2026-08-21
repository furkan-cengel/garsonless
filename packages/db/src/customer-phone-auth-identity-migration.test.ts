import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(
  new URL('../supabase/migrations/20260821010000_customer_phone_auth_identity_v2.sql', import.meta.url),
  'utf8',
)

test('phone auth identity accepts one verified contact and keeps claims service-only', () => {
  assert.match(migration, /claim_customer_identity_atomic_v2/)
  assert.match(migration, /v_email is null and v_phone is null/)
  assert.match(migration, /verified phone is invalid/)
  assert.match(migration, /assert_customer_identity_role_available\(p_auth_user_id, 'customer'\)/)
  assert.match(migration, /verified identity belongs to another auth account/)
  assert.match(migration, /revoke all on function public\.claim_customer_identity_atomic_v2[\s\S]*from public, anon, authenticated/i)
  assert.match(migration, /grant execute on function public\.claim_customer_identity_atomic_v2[\s\S]*to service_role/i)
})
