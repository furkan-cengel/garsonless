import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(
  new URL('../supabase/migrations/20260722030000_saas_billing_provider_inbox.sql', import.meta.url),
  'utf8',
)

test('provider inbox resolves subscription and invoice references before dispatch', () => {
  assert.match(migration, /provider_subscription_ref = p_provider_subscription_ref/)
  assert.match(migration, /provider_invoice_ref = p_provider_invoice_ref/)
  assert.match(migration, /provider_customer_reference_mismatch/)
  assert.match(migration, /'dispatchable', v_reason is null/)
})

test('provider inbox has replay-conflict and reconciliation boundaries', () => {
  assert.match(migration, /on conflict \(provider, provider_event_id\) do nothing/)
  assert.match(migration, /billing_provider_event_idempotency_conflict/)
  assert.match(migration, /insert into public\.billing_reconciliation_jobs/)
  assert.match(migration, /provider_snapshot_sanitized/)
  assert.doesNotMatch(migration, /raw_payload|raw_body/)
})

test('provider inbox RPCs are service-role only', () => {
  assert.match(migration, /revoke all on function public\.ingest_subscription_billing_provider_event[\s\S]*from public, anon, authenticated/)
  assert.match(migration, /grant execute on function public\.ingest_subscription_billing_provider_event[\s\S]*to service_role/)
  assert.match(migration, /grant execute on function public\.mark_subscription_billing_provider_event_failed[\s\S]*to service_role/)
})
