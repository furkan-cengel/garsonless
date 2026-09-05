import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(
  new URL('../supabase/migrations/20260901110000_subscription_refund_ledger.sql', import.meta.url),
  'utf8',
)
const hostReferenceScopeMigration = readFileSync(
  new URL('../supabase/migrations/20260902025000_subscription_refund_host_reference_scope.sql', import.meta.url),
  'utf8',
)

test('refund ledger requires authenticated payment identity and atomically caps reservations', () => {
  assert.match(migration, /provider_payment_id text/i)
  assert.match(migration, /bind_subscription_payment_provider_id/i)
  assert.match(migration, /status in \('requested', 'processing', 'succeeded', 'requires_reconciliation'\)/i)
  assert.match(migration, /p_amount_minor > v_invoice\.amount_paid_minor - v_reserved/i)
  assert.match(migration, /for update/i)
  assert.match(migration, /subscription_refund_payment_identity_missing/i)
})

test('same-day cancellation is full-only and provider uncertainty cannot be redispatched', () => {
  assert.match(migration, /p_kind = 'same_day_cancel'[\s\S]*p_amount_minor <> v_invoice\.amount_paid_minor/i)
  assert.match(migration, /Europe\/Istanbul/i)
  assert.match(migration, /requires_reconciliation/i)
  assert.match(migration, /billing\.reconciliation_required/i)
  assert.match(migration, /'dispatchable', false, 'duplicate', true/i)
})

test('successful refunds enqueue accounting review and never mutate entitlements', () => {
  assert.match(migration, /accounting_review_jobs[\s\S]*'refund_reported'/i)
  assert.match(migration, /refund\.requested/i)
  assert.match(migration, /refund\.succeeded/i)
  assert.doesNotMatch(migration, /update public\.restaurants[\s\S]*set plan/i)
  assert.doesNotMatch(migration, /update public\.restaurant_subscription_add_ons/i)
})

test('refund tables and RPCs remain service-role only', () => {
  assert.match(migration, /force row level security/i)
  assert.match(migration, /revoke all on table public\.subscription_refunds from public, anon, authenticated/i)
  for (const fn of ['prepare_platform_subscription_refund', 'complete_platform_subscription_refund', 'fail_platform_subscription_refund']) {
    assert.match(migration, new RegExp(`revoke all on function public\\.${fn}[\\s\\S]*from public, anon, authenticated`, 'i'))
  }
})

test('bank refund references are payment-scoped while authenticated Reporting refund IDs stay unique', () => {
  assert.match(hostReferenceScopeMigration, /drop index if exists public\.subscription_refunds_provider_ref_idx/i)
  assert.match(hostReferenceScopeMigration, /create unique index subscription_refunds_reporting_ref_idx/i)
  assert.match(hostReferenceScopeMigration, /provider_refund_ref like 'iyzico-reporting-refund:%'/i)
  assert.match(hostReferenceScopeMigration, /create index subscription_refunds_provider_ref_lookup_idx/i)
  assert.match(hostReferenceScopeMigration, /provider, provider_payment_id, provider_refund_ref/i)
  assert.doesNotMatch(hostReferenceScopeMigration, /create unique index subscription_refunds_provider_ref_lookup_idx/i)
})
