import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql = readFileSync(
  new URL('../supabase/migrations/20260904010000_retire_parasut_accounting.sql', import.meta.url),
  'utf8',
)

test('Paraşüt retirement fails closed around anything except pristine legacy jobs', () => {
  assert.match(sql, /lock table public\.accounting_invoice_jobs in share row exclusive mode/i)
  assert.match(sql, /provider_name = 'parasut'[\s\S]*status in \('pending', 'retry'\)/i)
  assert.match(sql, /attempts = 0/i)
  assert.match(sql, /provider_contact_ref is null/i)
  assert.match(sql, /provider_invoice_ref is null/i)
  assert.match(sql, /provider_task_ref is null/i)
  assert.match(sql, /provider_document_ref is null/i)
  assert.match(sql, /fiscal_document_type is null/i)
  assert.match(sql, /locked_at is null[\s\S]*locked_by is null[\s\S]*completed_at is null/i)
  assert.match(sql, /last_error_code is null/i)
  assert.match(sql, /raise exception 'parasut_retirement_requires_manual_review'/i)
})

test('only safe Paraşüt jobs are quarantined and retained as audit records', () => {
  assert.match(sql, /update public\.accounting_invoice_jobs[\s\S]*set status = 'failed'/i)
  assert.match(sql, /last_error_code = 'ACCOUNTING_PROVIDER_RETIRED'/i)
  assert.doesNotMatch(sql, /delete from public\.accounting_invoice_jobs/i)
  assert.doesNotMatch(sql, /delete from public\.subscription_invoices/i)
})

test('retired Paraşüt secrets and OAuth entry points are removed', () => {
  assert.match(sql, /delete from vault\.secrets\s+where name = 'parasut_refresh_token'/i)
  for (const signature of [
    'initialize_parasut_refresh_token\\(text\\)',
    'configure_parasut_refresh_token\\(text\\)',
    'claim_parasut_refresh_token\\(text, integer\\)',
    'rotate_parasut_refresh_token\\(text, bigint, text\\)',
    'release_parasut_refresh_token\\(text, bigint\\)',
  ]) assert.match(sql, new RegExp(`drop function if exists public\\.${signature}`, 'i'))
})

test('accounting claims become Nilvera-only and remain service-role restricted', () => {
  assert.match(sql, /p_provider_name is distinct from 'nilvera'/i)
  assert.match(sql, /provider_name is null or provider_name = 'nilvera'/i)
  assert.match(sql, /provider_name = coalesce\(job\.provider_name, 'nilvera'\)/i)
  assert.match(sql, /for update skip locked/i)
  assert.match(sql, /revoke all on function public\.claim_accounting_invoice_jobs\(text,text,integer\)/i)
  assert.match(sql, /grant execute on function public\.claim_accounting_invoice_jobs\(text,text,integer\)\s+to service_role/i)
})
