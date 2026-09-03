-- Resolve an ambiguous cancellation only after an authenticated, read-only
-- provider lookup proves that the exact subscription reference is cancelled.

begin;

create function public.resolve_subscription_cancellation_target_reconciliation(
  p_cancellation_request_id uuid,
  p_cancellation_target_id uuid,
  p_operation_id uuid,
  p_worker text,
  p_provider_cancelled_at timestamptz,
  p_verification_note text,
  p_occurred_at timestamptz default clock_timestamp()
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.subscription_cancellation_requests%rowtype;
  v_target public.subscription_cancellation_provider_targets%rowtype;
  v_operation public.billing_provider_operations%rowtype;
  v_result jsonb;
begin
  if p_cancellation_request_id is null or p_cancellation_target_id is null
    or p_operation_id is null or p_provider_cancelled_at is null or p_occurred_at is null
    or char_length(btrim(coalesce(p_worker, ''))) not between 1 and 160
    or char_length(btrim(coalesce(p_verification_note, ''))) not between 1 and 500 then
    raise exception 'billing_cancellation_resolution_input_invalid' using errcode = '22023';
  end if;

  select * into v_request from public.subscription_cancellation_requests
  where id = p_cancellation_request_id for update;
  select * into v_target from public.subscription_cancellation_provider_targets
  where id = p_cancellation_target_id
    and cancellation_request_id = p_cancellation_request_id for update;
  select * into v_operation from public.billing_provider_operations
  where id = p_operation_id and operation_type = 'subscription.cancel' for update;
  if v_request.id is null or v_target.id is null or v_operation.id is null
    or v_target.provider_operation_id <> v_operation.id
    or v_operation.subscription_id <> v_request.subscription_id
    or v_operation.restaurant_id <> v_request.restaurant_id
    or v_operation.provider_subscription_ref <> v_target.provider_subscription_ref then
    raise exception 'billing_cancellation_resolution_context_invalid' using errcode = 'P0001';
  end if;
  if v_target.status = 'applied' then
    return jsonb_build_object(
      'cancellationRequestId', v_request.id,
      'subscriptionId', v_request.subscription_id,
      'status', v_request.status,
      'requestCompleted', v_request.status = 'applied',
      'duplicate', true
    );
  end if;
  if v_request.status <> 'requires_reconciliation'
    or v_target.status <> 'requires_reconciliation'
    or v_operation.status <> 'requires_reconciliation' then
    raise exception 'billing_cancellation_resolution_not_reconcilable' using errcode = '55000';
  end if;

  update public.billing_reconciliation_jobs
  set status = 'resolved', completed_at = p_occurred_at,
      locked_at = null, locked_by = null, discrepancy_code = null, last_error = null,
      local_snapshot = local_snapshot || jsonb_build_object(
        'cancellationRequestId', v_request.id,
        'cancellationTargetId', v_target.id,
        'resolvedBy', btrim(p_worker)
      ),
      provider_snapshot_sanitized = provider_snapshot_sanitized || jsonb_build_object(
        'subscriptionStatus', 'cancelled',
        'verifiedAt', p_occurred_at,
        'verificationNote', btrim(p_verification_note)
      )
  where dedupe_key = 'cancellation-target:' || v_target.id
    and status <> 'resolved';

  update public.billing_provider_operations
  set status = 'processing', last_error = null
  where id = v_operation.id;
  update public.subscription_cancellation_provider_targets
  set status = 'processing', locked_at = p_occurred_at,
      locked_by = btrim(p_worker), last_error = null
  where id = v_target.id;
  update public.subscription_cancellation_requests
  set status = 'processing', provider_operation_id = v_operation.id,
      locked_at = p_occurred_at, locked_by = btrim(p_worker), last_error = null
  where id = v_request.id;

  v_result := public.complete_subscription_cancellation_target(
    v_request.id, v_target.id, v_operation.id, btrim(p_worker),
    p_provider_cancelled_at, p_occurred_at
  );
  return v_result || jsonb_build_object('resolvedFromReconciliation', true);
end;
$$;

revoke all on function public.resolve_subscription_cancellation_target_reconciliation(
  uuid,uuid,uuid,text,timestamptz,text,timestamptz
) from public, anon, authenticated;
grant execute on function public.resolve_subscription_cancellation_target_reconciliation(
  uuid,uuid,uuid,text,timestamptz,text,timestamptz
) to service_role;

comment on function public.resolve_subscription_cancellation_target_reconciliation(
  uuid,uuid,uuid,text,timestamptz,text,timestamptz
) is 'Finalizes one ambiguous cancellation target only after an authenticated provider lookup confirms the exact reference is cancelled.';

commit;
