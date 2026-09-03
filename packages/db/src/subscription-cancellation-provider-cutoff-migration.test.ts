import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql = readFileSync(
  new URL('../supabase/migrations/20260903021000_subscription_cancellation_provider_cutoff.sql', import.meta.url),
  'utf8',
)

test('period-end provider cancellation is scheduled before the paid-period boundary', () => {
  assert.match(sql, /effective_at - interval '24 hours'/)
  assert.match(sql, /new\.next_attempt_at := new\.provider_cancel_at/)
  assert.match(sql, /request\.provider_cancel_at <= p_occurred_at/)
  assert.doesNotMatch(
    sql.match(/create function public\.claim_subscription_cancellations_before_renewal[\s\S]*?\n\$\$;/)?.[0] ?? '',
    /request\.effective_at <= p_occurred_at/,
  )
})

test('provider cutoff completion keeps paid local access until effectiveAt', () => {
  const completion = sql.match(
    /create function public\.complete_subscription_cancellation_provider_cutoff[\s\S]*?\n\$\$;/,
  )?.[0] ?? ''
  assert.match(completion, /status = 'provider_cancelled'/)
  assert.match(completion, /'requestCompleted', false/)
  assert.doesNotMatch(completion, /update public\.restaurants set plan|set status = 'cancelled'/)
})

test('boundary application serializes the renewal race and keeps renewed access', () => {
  const access = sql.match(
    /create function public\.apply_due_subscription_cancellation_access[\s\S]*?\n\$\$;/,
  )?.[0] ?? ''
  assert.match(access, /where id = v_request\.subscription_id[\s\S]*for update/)
  assert.match(access, /current_period_end is distinct from v_request\.effective_at/)
  assert.match(access, /event\.event_type = 'invoice\.payment_succeeded'/)
  assert.match(access, /event\.status in \('received', 'processing', 'failed'\)/)
  assert.match(access, /event\.status = 'dead_lettered'/)
  assert.match(access, /status = 'requires_reconciliation'/)
  assert.match(access, /'period_end_cancellation_renewal_race'/)
  const reconciliation = access.indexOf("'period_end_cancellation_renewal_race'")
  const localCancellation = access.indexOf("set status = 'cancelled'")
  assert.ok(reconciliation >= 0 && localCancellation > reconciliation)
})

test('access replay is status-gated and service-only', () => {
  assert.match(sql, /request\.status = 'provider_cancelled'/)
  assert.match(sql, /grant execute on function public\.apply_due_subscription_cancellation_access[\s\S]*to service_role/)
  assert.match(sql, /revoke all on function public\.claim_due_subscription_cancellations[\s\S]*from service_role/)
  assert.match(sql, /revoke all on function public\.complete_subscription_cancellation_target[\s\S]*from service_role/)
})

test('provider-cancelled intent stays visible and blocks plan changes until access closes', () => {
  assert.match(sql, /cancellation\.status in \([\s\S]*'provider_cancelled'[\s\S]*\)/)
  assert.match(sql, /read_subscription_billing_settings_before_provider_cutoff/)
  assert.match(sql, /'cancellationStatus', v_cancellation\.status/)
  assert.match(sql, /new\.mode = 'immediate_refund'[\s\S]*status = 'superseded'/)
})
