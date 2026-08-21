import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql = readFileSync(new URL('../supabase/migrations/20260815020000_accounting_invoice_foundation.sql', import.meta.url), 'utf8')

test('paid subscription invoices enqueue one service-only accounting job', () => {
  assert.match(sql, /subscription_invoice_id uuid not null unique/i)
  assert.match(sql, /new\.status <> 'paid'/i)
  assert.match(sql, /on conflict \(subscription_invoice_id\) do nothing/i)
  assert.match(sql, /revoke all on public\.accounting_invoice_jobs, public\.accounting_review_jobs from public, anon, authenticated/i)
})

test('accounting failures retry without changing subscription activation', () => {
  assert.match(sql, /for update skip locked/i)
  assert.match(sql, /checkpoint_accounting_invoice_job/i)
  assert.match(sql, /status = case when p_retryable and attempts < 25 then 'retry' else 'failed' end/i)
  assert.doesNotMatch(sql, /update public\.billing_subscriptions set\s+status = 'suspended'/i)
})

test('cancellations create review work and never delete a fiscal document', () => {
  assert.match(sql, /accounting_review_jobs/i)
  assert.match(sql, /'subscription_cancelled'/i)
  assert.doesNotMatch(sql, /delete from public\.accounting_invoice_jobs/i)
})
