import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql = readFileSync(
  new URL('../supabase/migrations/20260902042000_parasut_accounting_worker_timeout.sql', import.meta.url),
  'utf8',
)

test('accounting scheduler timeout stays below the route execution ceiling', () => {
  assert.match(sql, /timeout_milliseconds := 55000/i)
  assert.match(sql, /authorization', 'Bearer ' \|\| v_secret/i)
  assert.match(sql, /revoke all on function public\.invoke_accounting_invoice_worker/i)
})
