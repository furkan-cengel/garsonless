import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(new URL('../supabase/migrations/20260815010000_legal_acceptance_foundation.sql', import.meta.url), 'utf8')

test('legal acceptance evidence is service-only, versioned and separates notice from consent', () => {
  assert.match(migration, /create table public\.legal_document_acceptances/i)
  assert.match(migration, /'b2b_terms', 'privacy_notice_presented'/)
  assert.match(migration, /unique \(user_id, document_type, document_version, evidence_key\)/i)
  assert.match(migration, /record_signup_legal_evidence[\s\S]*'b2b_terms'[\s\S]*'privacy_notice_presented'/i)
  assert.match(migration, /revoke all on table public\.legal_document_acceptances from public, anon, authenticated/i)
  assert.match(migration, /references auth\.users\(id\) on delete restrict/i)
  assert.doesNotMatch(migration, /raw_ip|ip_address/i)
})

test('checkout evidence binds customer, plan and amount context to a unique request key', () => {
  assert.match(migration, /checkout_summary_accepted/)
  assert.match(migration, /document_context jsonb not null/)
  assert.match(migration, /evidence_key text not null/)
  assert.match(migration, /unique \(user_id, document_type, document_version, evidence_key\)/)
})
