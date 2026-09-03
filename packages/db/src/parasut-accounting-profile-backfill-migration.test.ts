import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql = readFileSync(
  new URL('../supabase/migrations/20260902041000_parasut_accounting_profile_backfill.sql', import.meta.url),
  'utf8',
)

test('Paraşüt profile backfill requeues only fully-addressed paid jobs without provider calls', () => {
  assert.match(sql, /job\.status = 'needs_profile'/i)
  assert.match(sql, /invoice\.paid_at is not null/i)
  assert.match(sql, /customer\.billing_address->>'address'/i)
  assert.match(sql, /customer\.billing_address->>'city'/i)
  assert.match(sql, /customer\.billing_address->>'district'/i)
  assert.match(sql, /then 'pending'/i)
  assert.doesNotMatch(sql, /net\.http|api\.parasut|provider_invoice_ref\s*=/i)
})
