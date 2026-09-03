import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(new URL(
  '../supabase/migrations/20260902020000_subscription_refund_access_cancellation.sql',
  import.meta.url,
), 'utf8')
const reconciliationMigration = readFileSync(new URL(
  '../supabase/migrations/20260902021000_subscription_refund_cancellation_reconciliation_resolution.sql',
  import.meta.url,
), 'utf8')
const refundReconciliationMigration = readFileSync(new URL(
  '../supabase/migrations/20260902022000_subscription_refund_reconciliation_resolution.sql',
  import.meta.url,
), 'utf8')
const timestampNormalizationMigration = readFileSync(new URL(
  '../supabase/migrations/20260902023000_subscription_refund_reporting_timestamp_normalization.sql',
  import.meta.url,
), 'utf8')
const terminalStatusMigration = readFileSync(new URL(
  '../supabase/migrations/20260902024000_subscription_cancellation_terminal_status_resolution.sql',
  import.meta.url,
), 'utf8')
const terminalStatusRenameMigration = readFileSync(new URL(
  '../supabase/migrations/20260902024200_rename_subscription_cancellation_terminal_rpc.sql',
  import.meta.url,
), 'utf8')

test('refund access policy is enforced in the database before provider cancellation dispatch', () => {
  assert.match(migration, /access_action in \('keep', 'cancel_immediately'\)/)
  assert.match(migration, /kind <> 'same_day_cancel' or access_action = 'cancel_immediately'/)
  assert.match(migration, /scope <> 'partial' or access_action = 'keep'/)
  assert.match(migration, /subscription_partial_refund_cannot_cancel_access/)
  assert.match(migration, /if v_refund\.access_action = 'cancel_immediately' then[\s\S]*enqueue_refund_subscription_cancellation/)
  assert.match(migration, /if v_refund\.status = 'succeeded'/)
})

test('full-refund cancellation is fail-closed, multi-reference and idempotent', () => {
  assert.match(migration, /refund_cancel_pending/)
  assert.match(migration, /subscription_cancellation_requests_source_refund_key unique/)
  assert.match(migration, /unique \(cancellation_request_id, provider_subscription_ref\)/)
  assert.match(migration, /ref_role in \('current', 'scheduled'\)/)
  assert.match(migration, /billing:cancellation-target:/)
  assert.match(migration, /v_remaining > 0/)
  assert.match(migration, /preserve_refund_cancellation_access_lock/)
})

test('ambiguous money and cancellation results never trigger blind provider retries', () => {
  assert.match(migration, /subscription_refund_provider_uncertain/)
  assert.match(migration, /subscription_cancellation_result_ambiguous/)
  assert.match(migration, /status = 'requires_reconciliation'/)
  assert.doesNotMatch(migration, /status = 'scheduled'.*retry_delay/is)
})

test('successful historic same-day refunds are backfilled without provider calls', () => {
  const backfill = migration.slice(migration.indexOf('-- Forward-only, provider-call-free backfill'))
  assert.match(backfill, /kind = 'same_day_cancel'/)
  assert.match(backfill, /status = 'succeeded'/)
  assert.match(backfill, /enqueue_refund_subscription_cancellation/)
  assert.doesNotMatch(backfill, /iyzipay|https:\/\/|cancelSubscription/)
})

test('ambiguous cancellation can finish only through explicit provider verification evidence', () => {
  assert.match(reconciliationMigration, /resolve_subscription_cancellation_target_reconciliation/)
  assert.match(reconciliationMigration, /status <> 'requires_reconciliation'/)
  assert.match(reconciliationMigration, /provider_snapshot_sanitized/)
  assert.match(reconciliationMigration, /'subscriptionStatus', 'cancelled'/)
  assert.match(reconciliationMigration, /complete_subscription_cancellation_target/)
  assert.doesNotMatch(reconciliationMigration, /cancelSubscription|https:\/\//)
})

test('provider-confirmed refund reconciliation never redispatches money and cancels scheduled changes first', () => {
  assert.match(refundReconciliationMigration, /cancel_scheduled_changes_before_refund_cancellation/)
  assert.match(refundReconciliationMigration, /status = 'cancelled'[\s\S]*status = 'scheduled'/)
  assert.match(refundReconciliationMigration, /resolve_platform_subscription_refund_reconciliation/)
  assert.match(refundReconciliationMigration, /local_completion_failed_after_provider_success/)
  assert.match(refundReconciliationMigration, /provider_snapshot_sanitized/)
  assert.match(refundReconciliationMigration, /'refundStatus', 'totally_refunded'/)
  assert.match(refundReconciliationMigration, /complete_platform_subscription_refund/)
  assert.doesNotMatch(refundReconciliationMigration, /refundV2|\/v2\/payment\/refund|https:\/\//)
})

test('reporting timestamp correction is provider-call-free and narrowly scoped to implausible future evidence', () => {
  assert.match(timestampNormalizationMigration, /iyzico-reporting-refund:%/)
  assert.match(timestampNormalizationMigration, /completed_at > requested_at \+ interval '15 minutes'/)
  assert.match(timestampNormalizationMigration, /subscription_cancellation_provider_targets/)
  assert.match(timestampNormalizationMigration, /timestampNormalization/)
  assert.doesNotMatch(timestampNormalizationMigration, /refundV2|cancelSubscription|https:\/\//)
})

test('immediate-refund cancellation accepts only authenticated non-billable terminal provider states', () => {
  assert.match(terminalStatusMigration, /v_request\.mode <> 'immediate_refund'/)
  assert.match(terminalStatusMigration, /v_terminal_status not in \('cancelled', 'upgraded', 'expired'\)/)
  assert.match(terminalStatusMigration, /v_request\.status not in \('processing', 'requires_reconciliation'\)/)
  assert.match(terminalStatusMigration, /'subscriptionStatus', v_terminal_status/)
  assert.match(terminalStatusMigration, /'terminalWithoutFurtherCharge', true/)
  assert.match(terminalStatusMigration, /complete_subscription_cancellation_target/)
  assert.doesNotMatch(terminalStatusMigration, /cancelSubscription|https:\/\//)
  assert.match(terminalStatusRenameMigration, /rename to resolve_subscription_cancellation_target_terminal/)
  assert.match(terminalStatusRenameMigration, /notify pgrst, 'reload schema'/)
})
