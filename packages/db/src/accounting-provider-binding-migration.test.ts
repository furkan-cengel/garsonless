import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql = readFileSync(
  new URL('../supabase/migrations/20260903060000_accounting_provider_binding.sql', import.meta.url),
  'utf8',
)

test('attempted legacy accounting jobs remain bound to Paraşüt', () => {
  assert.match(sql, /set provider_name = 'parasut'/i)
  assert.match(sql, /where attempts > 0/i)
  assert.match(sql, /provider_document_ref is not null/i)
})

test('first claim atomically binds an unattempted job to the selected provider', () => {
  assert.match(sql, /p_provider_name not in \('parasut', 'nilvera'\)/i)
  assert.match(sql, /provider_name is null or provider_name = p_provider_name/i)
  assert.match(sql, /provider_name = coalesce\(job\.provider_name, p_provider_name\)/i)
  assert.match(sql, /'providerName', job\.provider_name/i)
  assert.match(sql, /for update skip locked/i)
})

test('provider-bound claim remains service-role only', () => {
  assert.match(sql, /revoke all on function public\.claim_accounting_invoice_jobs\(text,text,integer\)/i)
  assert.match(sql, /grant execute on function public\.claim_accounting_invoice_jobs\(text,text,integer\)\s+to service_role/i)
})
