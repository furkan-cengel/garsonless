-- iyzico Reporting may serialize its Europe/Istanbul wall clock with a `Z`
-- suffix. Earlier reconciliation treated that value as UTC, which could defer
-- immediate cancellation by three hours. Correct only authenticated reporting
-- reconciliations whose completion time is implausibly later than the request.

begin;

update public.billing_provider_operations operation
set completed_at = refund.requested_at
from public.subscription_refunds refund
where operation.id = refund.provider_operation_id
  and refund.status = 'succeeded'
  and refund.provider_refund_ref like 'iyzico-reporting-refund:%'
  and refund.completed_at > refund.requested_at + interval '15 minutes';

update public.subscription_cancellation_requests request
set effective_at = refund.requested_at,
    scheduled_at = refund.requested_at,
    next_attempt_at = refund.requested_at
from public.subscription_refunds refund
where request.source_refund_id = refund.id
  and request.mode = 'immediate_refund'
  and request.status = 'scheduled'
  and refund.provider_refund_ref like 'iyzico-reporting-refund:%'
  and refund.completed_at > refund.requested_at + interval '15 minutes';

update public.subscription_cancellation_provider_targets target
set next_attempt_at = refund.requested_at
from public.subscription_cancellation_requests request
join public.subscription_refunds refund on refund.id = request.source_refund_id
where target.cancellation_request_id = request.id
  and target.status = 'scheduled'
  and refund.provider_refund_ref like 'iyzico-reporting-refund:%'
  and refund.completed_at > refund.requested_at + interval '15 minutes';

update public.subscription_change_requests change
set cancelled_at = refund.requested_at
from public.subscription_refunds refund
where change.subscription_id = refund.subscription_id
  and change.restaurant_id = refund.restaurant_id
  and change.status = 'cancelled'
  and change.last_error = 'superseded_by_immediate_refund_cancellation'
  and refund.provider_refund_ref like 'iyzico-reporting-refund:%'
  and refund.completed_at > refund.requested_at + interval '15 minutes';

update public.tenant_lifecycle_events lifecycle
set occurred_at = refund.requested_at
from public.subscription_refunds refund
where lifecycle.request_id = 'billing:refund-cancel-pending:' || refund.id
  and refund.provider_refund_ref like 'iyzico-reporting-refund:%'
  and refund.completed_at > refund.requested_at + interval '15 minutes';

update public.billing_reconciliation_jobs job
set provider_snapshot_sanitized = jsonb_set(
      job.provider_snapshot_sanitized,
      '{providerRefundedAt}', to_jsonb(refund.requested_at), true
    ) || jsonb_build_object('timestampNormalization', 'request_time_fallback')
from public.subscription_refunds refund
where job.dedupe_key = 'subscription-refund:' || refund.id
  and refund.provider_refund_ref like 'iyzico-reporting-refund:%'
  and refund.completed_at > refund.requested_at + interval '15 minutes';

update public.subscription_refunds
set completed_at = requested_at
where status = 'succeeded'
  and provider_refund_ref like 'iyzico-reporting-refund:%'
  and completed_at > requested_at + interval '15 minutes';

commit;
