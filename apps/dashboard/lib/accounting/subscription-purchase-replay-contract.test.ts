import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8')
}

const outbox = source('../../../../packages/db/supabase/migrations/20260714040000_domain_outbox.sql')
const payment = source('../../../../packages/db/supabase/migrations/20260722020000_saas_billing_atomic_transitions.sql')
const activation = source('../../../../packages/db/supabase/migrations/20260904020000_first_paid_activation_welcome.sql')
const accounting = source('../../../../packages/db/supabase/migrations/20260815020000_accounting_invoice_foundation.sql')
const fiscal = source('../../../../packages/db/supabase/migrations/20260902040000_parasut_e_document_contract.sql')
const worker = source('../../app/api/internal/accounting-invoices/route.ts')
const invoiceEmail = source('./invoice-email.ts')

test('payment callback and webhook replays converge on one paid event and first activation', () => {
  assert.match(outbox, /on conflict \(idempotency_key\) do nothing/i)
  assert.match(payment, /'invoice\.paid'[\s\S]*p_idempotency_key \|\| ':outbox:paid'/)
  assert.match(activation, /restaurant_id uuid primary key/)
  assert.match(activation, /on conflict \(restaurant_id\) do nothing/)
  assert.match(activation, /'firstPaidActivation', v_first_invoice_id = v_invoice\.id/)
})

test('one paid invoice can enqueue and formalize only one provider-bound fiscal job', () => {
  assert.match(accounting, /subscription_invoice_id uuid not null unique/i)
  assert.match(accounting, /on conflict \(subscription_invoice_id\) do nothing/i)
  assert.match(fiscal, /provider_document_ref = coalesce\(nullif\(btrim\(p_provider_document_ref\), ''\), provider_document_ref\)/i)
  assert.match(fiscal, /'billing:fiscal-document-ready:v1:' \|\| v_job\.subscription_invoice_id/i)
})

test('worker replay keeps one PDF e-mail delivery and completes only after its receipt', () => {
  assert.match(invoiceEmail, /idempotencyKey: `masabu-invoice-email-\$\{job\.id\}`/)
  assert.ok(worker.indexOf('await sendInvoiceEmail') < worker.indexOf('port.recordEmailDelivery'))
  assert.ok(worker.indexOf('port.recordEmailDelivery') < worker.indexOf('await port.complete'))
  assert.match(worker, /providerDocumentRef: document\.ref/)
})
