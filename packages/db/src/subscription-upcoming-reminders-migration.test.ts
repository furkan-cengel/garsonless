import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(
  new URL('../supabase/migrations/20260901050000_subscription_upcoming_invoice_reminders.sql', import.meta.url),
  'utf8',
)

test('upcoming reminder uses the platform D-N policy and active provider periods only', () => {
  assert.match(migration, /pre_due_reminder_days/)
  assert.match(migration, /subscription\.status = 'active'/)
  assert.match(migration, /subscription\.provider = 'iyzico'/)
  assert.match(migration, /subscription\.cancel_at_period_end = false/)
  assert.match(migration, /current_period_end <= p_occurred_at \+ make_interval\(days => v_reminder_days\)/)
})

test('upcoming reminder is one semantic occurrence per subscription period', () => {
  assert.match(migration, /'billing:invoice-upcoming:v1:' \|\| candidate\.id/)
  assert.match(migration, /extract\(epoch from candidate\.current_period_end\)::bigint/)
  assert.match(migration, /on conflict \(idempotency_key\) do nothing/)
  assert.match(migration, /'semanticVersion', 1/)
})

test('upcoming scheduler is notification-only and service-role-only', () => {
  assert.doesNotMatch(migration, /insert into public\.subscription_invoices/)
  assert.doesNotMatch(migration, /update public\.billing_subscriptions/)
  assert.match(migration, /revoke all on function public\.enqueue_subscription_upcoming_invoice_reminders[\s\S]*from public, anon, authenticated/)
  assert.match(migration, /grant execute on function public\.enqueue_subscription_upcoming_invoice_reminders[\s\S]*to service_role/)
})
