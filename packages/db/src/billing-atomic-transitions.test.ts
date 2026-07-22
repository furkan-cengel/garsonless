import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(
  new URL('../supabase/migrations/20260722020000_saas_billing_atomic_transitions.sql', import.meta.url),
  'utf8',
)

const functions = [
  'create_subscription_invoice_atomic',
  'record_subscription_payment_failure_atomic',
  'record_subscription_payment_success_atomic',
] as const

test('billing transition RPCs are service-role-only security-definer boundaries', () => {
  for (const name of functions) {
    assert.match(migration, new RegExp(`create or replace function public\\.${name}`))
    assert.match(migration, new RegExp(`revoke all on function public\\.${name}`))
    assert.match(migration, new RegExp(`grant execute on function public\\.${name}`))
  }
  assert.equal((migration.match(/security definer/g) ?? []).length, 3)
  assert.equal((migration.match(/set search_path = public, pg_temp/g) ?? []).length, 3)
  assert.doesNotMatch(migration, /payload_raw|raw_payload|webhook_body/)
})

test('invoice creation locks its subscription and writes invoice.created in the same transaction', () => {
  assert.match(migration, /from public\.billing_subscriptions[\s\S]*?for update/)
  assert.match(migration, /insert into public\.subscription_invoices/)
  assert.match(migration, /'invoice\.created'/)
  assert.match(migration, /billing_idempotency_conflict/)
})

test('payment failure is replay-safe, cannot regress paid invoices and schedules one dunning run', () => {
  assert.match(migration, /v_event\.event_type <> 'invoice\.payment_failed'/)
  assert.match(migration, /if v_invoice\.status = 'paid'/)
  assert.match(migration, /insert into public\.subscription_payment_attempts/)
  assert.match(migration, /insert into public\.dunning_runs/)
  assert.match(migration, /on conflict \(invoice_id\) do nothing/)
  assert.match(migration, /'invoice\.payment_failed'/)
  assert.match(migration, /'subscription\.status_changed'/)
})

test('first payment success atomically pays, stops dunning and updates entitlement projection', () => {
  assert.match(migration, /subscription_payment_attempts_one_success_per_invoice_idx/)
  assert.match(migration, /set status = 'paid', amount_paid_minor = amount_due_minor/)
  assert.match(migration, /update public\.dunning_runs[\s\S]*?set status = 'stopped'/)
  assert.match(migration, /update public\.restaurants set plan = v_invoice\.plan/)
  assert.match(migration, /when v_from_status in \('manual_hold', 'cancelled'\) then v_from_status/)
  assert.match(migration, /'invoice\.paid'/)
  assert.match(migration, /'tenant\.reactivated'/)
})

test('provider events and lifecycle audits are completed inside payment transactions', () => {
  assert.match(migration, /from public\.billing_provider_events[\s\S]*?for update/)
  assert.match(migration, /set status = 'processed', attempts = attempts \+ 1/)
  assert.match(migration, /insert into public\.tenant_lifecycle_events/)
  assert.match(migration, /actor_type[\s\S]*?'payment_provider'/)
})
