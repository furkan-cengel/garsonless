import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql = readFileSync(
  new URL('../supabase/migrations/20260901100000_subscription_period_end_cancellation.sql', import.meta.url),
  'utf8',
)

test('period-end cancellation is a durable reversible owner intent', () => {
  assert.match(sql, /create table public\.subscription_cancellation_requests/)
  assert.match(sql, /create function public\.schedule_subscription_cancellation/)
  assert.match(sql, /create function public\.withdraw_subscription_cancellation/)
  assert.match(sql, /cancel_at_period_end = true/)
  assert.match(sql, /cancel_at_period_end = false/)
  assert.match(sql, /billing:cancellation-scheduled:v1:/)
  assert.match(sql, /billing:cancellation-withdrawn:v1:/)
})

test('due provider cancellation is leased and ambiguous claims cannot redispatch', () => {
  assert.match(sql, /create function public\.claim_due_subscription_cancellations/)
  assert.match(sql, /for update skip locked limit p_limit/)
  assert.match(sql, /stale_scheduled_cancellation_claim/)
  assert.match(sql, /status = 'requires_reconciliation'/)
  assert.match(sql, /create function public\.complete_scheduled_subscription_cancellation/)
  assert.match(sql, /create function public\.fail_scheduled_subscription_cancellation/)
})

test('provider success closes subscription and emits explicit cancellation evidence atomically', () => {
  assert.match(sql, /status = 'cancelled', cancelled_at = p_provider_cancelled_at/)
  assert.match(sql, /'tenant_cancelled_period_end'/)
  assert.match(sql, /'subscription\.cancelled'/)
  assert.match(sql, /'subscription\.status_changed'/)
  assert.match(sql, /'billing:subscription-cancelled:v1:' \|\| v_request\.id/)
  assert.match(sql, /update public\.restaurants set plan = 'starter'/)
})

test('owner settings and plan-change backstop expose and protect pending cancellation', () => {
  assert.match(sql, /reject_subscription_change_during_scheduled_cancellation/)
  assert.match(sql, /'cancellationRequestId', v_cancellation\.id/)
  assert.match(sql, /'cancellationEffectiveAt', v_cancellation\.effective_at/)
  assert.match(sql, /'cancellationStatus', v_cancellation\.status/)
})

test('cancellation RPCs stay service-role-only and provider failure preserves local access state', () => {
  for (const name of [
    'schedule_subscription_cancellation',
    'withdraw_subscription_cancellation',
    'claim_due_subscription_cancellations',
    'complete_scheduled_subscription_cancellation',
    'fail_scheduled_subscription_cancellation',
  ]) {
    assert.match(sql, new RegExp(`revoke all on function public\\.${name}`))
    assert.match(sql, new RegExp(`grant execute on function public\\.${name}`))
  }
  const failure = sql.slice(sql.indexOf('create function public.fail_scheduled_subscription_cancellation'))
  assert.match(failure, /status = 'requires_reconciliation'/)
  assert.doesNotMatch(failure, /status = 'cancelled'|update public\.restaurants set plan/)
})
