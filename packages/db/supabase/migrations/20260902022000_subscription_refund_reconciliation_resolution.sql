-- Resolve a refund whose provider call succeeded but whose local completion
-- rolled back. Resolution requires an authenticated, read-only iyzico
-- Reporting API observation; it never re-dispatches the refund.

begin;

create function public.cancel_scheduled_changes_before_refund_cancellation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'succeeded'
    and old.status is distinct from new.status
    and new.scope = 'full'
    and new.access_action = 'cancel_immediately' then
    update public.subscription_change_requests
    set status = 'cancelled',
        cancelled_at = coalesce(cancelled_at, new.completed_at, clock_timestamp()),
        last_error = 'superseded_by_immediate_refund_cancellation'
    where subscription_id = new.subscription_id
      and restaurant_id = new.restaurant_id
      and status = 'scheduled';
  end if;
  return new;
end;
$$;

create trigger cancel_scheduled_changes_before_refund_cancellation
  before update of status on public.subscription_refunds
  for each row execute function public.cancel_scheduled_changes_before_refund_cancellation();

create function public.resolve_platform_subscription_refund_reconciliation(
  p_refund_id uuid,
  p_operation_id uuid,
  p_provider_payment_id text,
  p_provider_refund_ref text,
  p_amount_minor bigint,
  p_worker text,
  p_provider_refunded_at timestamptz,
  p_verification_note text,
  p_occurred_at timestamptz default clock_timestamp()
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_refund public.subscription_refunds%rowtype;
  v_operation public.billing_provider_operations%rowtype;
  v_result jsonb;
begin
  if p_refund_id is null or p_operation_id is null or p_amount_minor <= 0
    or p_provider_refunded_at is null or p_occurred_at is null
    or char_length(btrim(coalesce(p_provider_payment_id, ''))) not between 1 and 200
    or char_length(btrim(coalesce(p_provider_refund_ref, ''))) not between 1 and 200
    or char_length(btrim(coalesce(p_worker, ''))) not between 1 and 160
    or char_length(btrim(coalesce(p_verification_note, ''))) not between 1 and 500 then
    raise exception 'subscription_refund_resolution_input_invalid' using errcode = '22023';
  end if;

  select * into v_refund from public.subscription_refunds
  where id = p_refund_id for update;
  select * into v_operation from public.billing_provider_operations
  where id = p_operation_id and operation_type = 'subscription.refund' for update;

  if v_refund.id is null or v_operation.id is null
    or v_refund.provider_operation_id <> v_operation.id
    or v_refund.provider_payment_id <> btrim(p_provider_payment_id)
    or v_refund.amount_minor <> p_amount_minor
    or v_operation.restaurant_id <> v_refund.restaurant_id
    or v_operation.subscription_id <> v_refund.subscription_id
    or v_operation.invoice_id <> v_refund.invoice_id
    or v_operation.provider_payment_ref <> v_refund.provider_payment_id
    or v_operation.amount_minor <> v_refund.amount_minor
    or v_operation.currency <> v_refund.currency then
    raise exception 'subscription_refund_resolution_context_invalid' using errcode = 'P0001';
  end if;

  if v_refund.status = 'succeeded' then
    if v_refund.provider_refund_ref <> btrim(p_provider_refund_ref) then
      raise exception 'subscription_refund_resolution_conflict' using errcode = 'P0001';
    end if;
    v_result := public.complete_platform_subscription_refund(
      v_refund.id, v_operation.id, v_refund.provider_payment_id,
      v_refund.provider_refund_ref, v_refund.amount_minor, p_provider_refunded_at
    );
  else
    if v_refund.status <> 'requires_reconciliation'
      or v_operation.status <> 'requires_reconciliation'
      or v_refund.failure_code <> 'local_completion_failed_after_provider_success'
      or v_operation.last_error <> 'local_completion_failed_after_provider_success' then
      raise exception 'subscription_refund_resolution_not_reconcilable' using errcode = '55000';
    end if;

    update public.subscription_refunds
    set status = 'processing', failure_code = null,
        completed_at = null, failed_at = null
    where id = v_refund.id;
    update public.billing_provider_operations
    set status = 'processing', last_error = null, completed_at = null
    where id = v_operation.id;

    v_result := public.complete_platform_subscription_refund(
      v_refund.id, v_operation.id, v_refund.provider_payment_id,
      btrim(p_provider_refund_ref), v_refund.amount_minor, p_provider_refunded_at
    );
  end if;

  update public.billing_reconciliation_jobs
  set status = 'resolved', completed_at = p_occurred_at,
      locked_at = null, locked_by = null, discrepancy_code = null, last_error = null,
      local_snapshot = local_snapshot || jsonb_build_object(
        'refundId', v_refund.id,
        'operationId', v_operation.id,
        'status', 'succeeded',
        'resolvedBy', btrim(p_worker)
      ),
      provider_snapshot_sanitized = provider_snapshot_sanitized || jsonb_build_object(
        'refundStatus', 'totally_refunded',
        'providerRefundRef', btrim(p_provider_refund_ref),
        'amountMinor', p_amount_minor,
        'currency', v_refund.currency,
        'providerRefundedAt', p_provider_refunded_at,
        'verifiedAt', p_occurred_at,
        'verificationNote', btrim(p_verification_note)
      )
  where dedupe_key = 'subscription-refund:' || v_refund.id
    and status <> 'resolved';

  return v_result || jsonb_build_object(
    'resolvedFromReconciliation', true,
    'verificationNote', btrim(p_verification_note)
  );
end;
$$;

revoke all on function public.resolve_platform_subscription_refund_reconciliation(
  uuid,uuid,text,text,bigint,text,timestamptz,text,timestamptz
) from public, anon, authenticated;
grant execute on function public.resolve_platform_subscription_refund_reconciliation(
  uuid,uuid,text,text,bigint,text,timestamptz,text,timestamptz
) to service_role;

comment on function public.resolve_platform_subscription_refund_reconciliation(
  uuid,uuid,text,text,bigint,text,timestamptz,text,timestamptz
) is 'Finalizes an ambiguous local refund only after authenticated iyzico Reporting API evidence proves the exact payment and amount were refunded; never dispatches money movement.';

commit;
