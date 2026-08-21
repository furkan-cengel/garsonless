import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(
  new URL('../supabase/migrations/20260821020000_customer_membership_legal_evidence.sql', import.meta.url),
  'utf8',
)

test('customer membership evidence is separate from B2B and marketing consent', () => {
  assert.match(migration, /customer_membership_terms/)
  assert.match(migration, /customer_privacy_notice_presented/)
  assert.match(migration, /record_customer_membership_legal_evidence/)
  assert.doesNotMatch(migration, /marketing/)
  assert.match(migration, /to service_role/)
})
