import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql = readFileSync(
  new URL('../supabase/migrations/20260903061000_accounting_legacy_provider_backfill.sql', import.meta.url),
  'utf8',
)

test('provider cutover binds every existing unbound job to Paraşüt', () => {
  assert.match(sql, /update public\.accounting_invoice_jobs/i)
  assert.match(sql, /set provider_name = 'parasut'/i)
  assert.match(sql, /where provider_name is null/i)
})

test('provider cutover does not change queue status or external identities', () => {
  assert.doesNotMatch(sql, /set\s+status\s*=/i)
  assert.doesNotMatch(sql, /provider_(contact|invoice|task|document)_ref\s*=/i)
  assert.doesNotMatch(sql, /delete from/i)
})
