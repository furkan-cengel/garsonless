import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql = readFileSync(
  new URL('../supabase/migrations/20260902040000_parasut_e_document_contract.sql', import.meta.url),
  'utf8',
)

test('Paraşüt e-document migration separates task and fiscal document identities', () => {
  assert.match(sql, /add column provider_document_ref text/i)
  assert.match(sql, /'providerDocumentRef', job\.provider_document_ref/i)
  assert.match(sql, /p_provider_document_ref text/i)
  assert.match(sql, /accounting_document_identity_invalid/i)
})

test('Paraşüt rotating refresh token is Vault-backed and service-only leased', () => {
  assert.match(sql, /vault\.decrypted_secrets/i)
  assert.match(sql, /vault\.update_secret/i)
  assert.match(sql, /accounting_provider_oauth_leases/i)
  assert.match(sql, /token_version = token_version \+ 1/i)
  assert.match(sql, /revoke all on function public\.claim_parasut_refresh_token/i)
  assert.doesNotMatch(sql, /insert into vault\.secrets/i)
})

test('paid accounting snapshots retain payment time and add-on identity', () => {
  assert.match(sql, /'paidAt', new\.paid_at/i)
  assert.match(sql, /'addOns', new\.add_ons/i)
  assert.match(sql, /new\.paid_at is not null/i)
  assert.match(sql, /new\.billing_address->>'district'/i)
  assert.match(sql, /create or replace function public\.requeue_accounting_jobs_after_profile_update/i)
})

test('accounting worker scheduler is provisioned from Vault without embedding credentials', () => {
  assert.match(sql, /configure_accounting_invoice_worker_vault/i)
  assert.match(sql, /invoke_accounting_invoice_worker/i)
  assert.match(sql, /vault\.decrypted_secrets/i)
  assert.match(sql, /authorization', 'Bearer ' \|\| v_secret/i)
  assert.match(sql, /accounting-invoice-worker-every-minute/i)
  assert.match(sql, /revoke all on function public\.configure_accounting_invoice_worker_vault/i)
})
