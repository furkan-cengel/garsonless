import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const migration = fs.readFileSync(path.resolve(
  here,
  '../supabase/migrations/20260722060000_saas_billing_maintenance.sql',
), 'utf8')
const worker = fs.readFileSync(path.resolve(
  here,
  '../supabase/functions/outbox-worker/index.ts',
), 'utf8')
const gsmContractMigration = fs.readFileSync(path.resolve(
  here,
  '../supabase/migrations/20260722070000_saas_billing_gsm_contract.sql',
), 'utf8')
const reconciliationProjectionMigration = fs.readFileSync(path.resolve(
  here,
  '../supabase/migrations/20260722080000_saas_billing_reconciliation_projection.sql',
), 'utf8')

test('dunning uses leased skip-locked claims and a bounded replay-safe state machine', () => {
  assert.match(migration, /for update skip locked/i)
  assert.match(migration, /locked_by is distinct from p_worker/i)
  assert.match(migration, /billing\.retry_requested/)
  assert.match(migration, /billing\.warning_3/)
  assert.match(migration, /billing\.warning_7/)
  assert.match(migration, /status = 'suspended'/)
  assert.match(migration, /update public\.restaurants set plan = 'free'/)
})

test('maintenance never infers payment success and reconciliation only escalates ambiguity', () => {
  assert.doesNotMatch(migration, /set status = 'paid'/)
  assert.match(migration, /manual_review_required/)
  assert.match(migration, /billing\.reconciliation_required/)
  assert.match(migration, /never auto-heals money state/i)
  assert.match(migration, /create or replace function public\.mark_subscription_billing_operation_reconciliation/)
  assert.match(migration, /insert into public\.billing_reconciliation_jobs/)
  assert.match(migration, /'provider-operation:' \|\| v_operation\.id/)
  assert.match(migration, /status = 'processing' and updated_at < now\(\) - interval '15 minutes'/)
  assert.match(migration, /status = 'awaiting_callback' and updated_at < now\(\) - interval '24 hours'/)
})

test('all billing maintenance RPCs are service-role only', () => {
  for (const name of [
    'claim_billing_dunning', 'advance_billing_dunning', 'fail_billing_dunning',
    'claim_billing_reconciliation', 'escalate_billing_reconciliation', 'fail_billing_reconciliation',
    'mark_subscription_billing_operation_reconciliation',
  ]) {
    assert.match(migration, new RegExp(`revoke all on function public\\.${name}`))
    assert.match(migration, new RegExp(`grant execute on function public\\.${name}`))
  }
})

test('mandatory billing inbox and email fan-out cannot be acknowledged while unconfigured', () => {
  assert.match(worker, /isMandatoryBillingNotificationEvent/)
  assert.match(worker, /throw new Error\('Mandatory billing inbox consumer is not configured'\)/)
  assert.match(worker, /throw new Error\('Mandatory billing email consumer is not configured'\)/)
})

test('billing profile GSM contract accepts the normalized optional leading plus format', () => {
  assert.match(gsmContractMigration, /gsm_number ~ '\^\\\+\?\[0-9\]\{10,15\}\$'/)
  assert.match(gsmContractMigration, /p_gsm_number !~ '\^\\\+\?\[0-9\]\{10,15\}\$'/)
  assert.match(gsmContractMigration, /revoke all on function public\.upsert_subscription_billing_profile/)
})

test('owner reconciliation projection does not double-count an operation and its job', () => {
  assert.match(reconciliationProjectionMigration, /job\.dedupe_key = 'provider-operation:' \|\| operation\.id/)
  assert.match(reconciliationProjectionMigration, /and not exists \(/)
  assert.match(reconciliationProjectionMigration, /job\.status in \('pending', 'running', 'discrepancy', 'failed'\)/)
})
