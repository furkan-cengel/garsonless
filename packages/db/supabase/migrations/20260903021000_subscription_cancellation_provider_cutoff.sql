-- Stop provider renewal before the paid-period boundary, but retain local
-- entitlement until that exact boundary. Provider cancellation and access
-- cancellation are intentionally two replay-safe phases.

begin;

alter table public.subscription_cancellation_requests
  add column provider_cancel_at timestamptz,
  add column provider_cancelled_at timestamptz;

update public.subscription_cancellation_requests
set provider_cancel_at = case
      when mode = 'period_end' then greatest(scheduled_at, effective_at - interval '24 hours')
      else scheduled_at
    end,
    provider_cancelled_at = case when status = 'applied' then applied_at else null end;

alter table public.subscription_cancellation_requests
  alter column provider_cancel_at set not null,
  drop constraint if exists subscription_cancellation_requests_status_check,
  drop constraint if exists subscription_cancellation_requests_state_check;

alter table public.subscription_cancellation_requests
  add constraint subscription_cancellation_requests_status_check check (status in (
    'scheduled', 'processing', 'provider_cancelled', 'applied', 'withdrawn',
    'superseded', 'requires_reconciliation'
  )),
  add constraint subscription_cancellation_requests_provider_cutoff_check check (
    (mode = 'period_end' and provider_cancel_at < effective_at)
    or (mode = 'immediate_refund' and provider_cancel_at <= effective_at)
  ),
  add constraint subscription_cancellation_requests_state_check check (
    (status = 'scheduled' and locked_at is null and locked_by is null
      and applied_at is null and withdrawn_at is null and superseded_at is null
      and provider_cancelled_at is null)
    or (status = 'processing' and locked_at is not null and locked_by is not null
      and provider_operation_id is not null and applied_at is null
      and withdrawn_at is null and superseded_at is null and provider_cancelled_at is null)
    or (status = 'provider_cancelled' and locked_at is null and locked_by is null
      and applied_at is null and withdrawn_at is null and superseded_at is null
      and provider_cancelled_at is not null)
    or (status = 'applied' and applied_at is not null
      and withdrawn_at is null and superseded_at is null)
    or (status = 'withdrawn' and withdrawn_at is not null and withdrawn_by is not null
      and withdrawal_idempotency_key is not null
      and withdrawal_request_fingerprint is not null
      and applied_at is null and superseded_at is null and provider_cancelled_at is null)
    or (status = 'superseded' and superseded_at is not null and applied_at is null)
    or (status = 'requires_reconciliation' and applied_at is null
      and withdrawn_at is null and superseded_at is null)
  );

drop index if exists subscription_cancellation_requests_one_live_idx;
create unique index subscription_cancellation_requests_one_live_idx
  on public.subscription_cancellation_requests(subscription_id)
  where status in ('scheduled', 'processing', 'provider_cancelled', 'requires_reconciliation');

drop index if exists subscription_cancellation_requests_due_idx;
create index subscription_cancellation_requests_due_idx
  on public.subscription_cancellation_requests(provider_cancel_at, next_attempt_at, created_at)
  where status = 'scheduled';

create function public.set_subscription_cancellation_provider_cutoff()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.provider_cancel_at := case
    when new.mode = 'period_end'
      then greatest(new.scheduled_at, new.effective_at - interval '24 hours')
    else new.scheduled_at
  end;
  new.next_attempt_at := new.provider_cancel_at;
  if new.mode = 'immediate_refund' then
    update public.subscription_cancellation_requests
    set status = 'superseded', superseded_at = new.scheduled_at,
        locked_at = null, locked_by = null,
        last_error = 'superseded_by_immediate_refund_cancellation'
    where subscription_id = new.subscription_id
      and status = 'provider_cancelled';
  end if;
  return new;
end;
$$;

create trigger set_subscription_cancellation_provider_cutoff
  before insert on public.subscription_cancellation_requests
  for each row execute function public.set_subscription_cancellation_provider_cutoff();

update public.subscription_cancellation_provider_targets target
set next_attempt_at = request.provider_cancel_at
from public.subscription_cancellation_requests request
where request.id = target.cancellation_request_id
  and target.status = 'scheduled';

create or replace function public.reject_subscription_change_during_scheduled_cancellation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status in ('processing', 'scheduled', 'paid_pending', 'paid_draining', 'requires_reconciliation')
    and exists (
      select 1 from public.subscription_cancellation_requests cancellation
      where cancellation.subscription_id = new.subscription_id
        and cancellation.restaurant_id = new.restaurant_id
        and cancellation.status in ('scheduled', 'processing', 'provider_cancelled', 'requires_reconciliation')
    ) then
    raise exception 'billing_cancellation_already_pending' using errcode = '55000';
  end if;
  return new;
end;
$$;

create function public.claim_subscription_cancellations_before_renewal(
  p_worker text,
  p_limit integer default 20,
  p_lease_seconds integer default 60,
  p_occurred_at timestamptz default clock_timestamp()
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_target public.subscription_cancellation_provider_targets%rowtype;
  v_request public.subscription_cancellation_requests%rowtype;
  v_subscription public.billing_subscriptions%rowtype;
  v_customer public.billing_customers%rowtype;
  v_operation public.billing_provider_operations%rowtype;
  v_results jsonb := '[]'::jsonb;
  v_fingerprint text;
begin
  if char_length(btrim(coalesce(p_worker, ''))) not between 1 and 160
    or p_limit not between 1 and 100 or p_lease_seconds not between 1 and 3600
    or p_occurred_at is null then
    raise exception 'billing_cancellation_claim_input_invalid' using errcode = '22023';
  end if;
  for v_target in
    select target.* from public.subscription_cancellation_provider_targets target
    where target.status = 'processing'
      and target.locked_at < p_occurred_at - make_interval(secs => p_lease_seconds)
    order by target.locked_at for update skip locked
  loop
    update public.billing_provider_operations set status = 'requires_reconciliation',
      last_error = 'stale_subscription_cancellation_target_claim'
    where id = v_target.provider_operation_id and status = 'processing';
    update public.subscription_cancellation_provider_targets
    set status = 'requires_reconciliation', locked_at = null, locked_by = null,
      last_error = 'stale_subscription_cancellation_target_claim'
    where id = v_target.id;
    update public.subscription_cancellation_requests
    set status = 'requires_reconciliation', locked_at = null, locked_by = null,
      last_error = 'stale_subscription_cancellation_target_claim'
    where id = v_target.cancellation_request_id and status <> 'applied';
    insert into public.billing_reconciliation_jobs (
      restaurant_id, subscription_id, provider, scope, dedupe_key,
      local_snapshot, provider_snapshot_sanitized, discrepancy_code, last_error
    ) values (
      v_target.restaurant_id, v_target.subscription_id, 'iyzico', 'subscription',
      'cancellation-target:' || v_target.id,
      jsonb_build_object('cancellationTargetId', v_target.id,
        'cancellationRequestId', v_target.cancellation_request_id),
      '{}'::jsonb, 'subscription_cancellation_result_ambiguous',
      'stale_subscription_cancellation_target_claim'
    ) on conflict (dedupe_key) do nothing;
  end loop;
  for v_target in
    select target.* from public.subscription_cancellation_provider_targets target
    join public.subscription_cancellation_requests request
      on request.id = target.cancellation_request_id
    where target.status = 'scheduled' and target.next_attempt_at <= p_occurred_at
      and request.status in ('scheduled', 'processing')
      and request.provider_cancel_at <= p_occurred_at
    order by request.provider_cancel_at, target.created_at
    for update of target skip locked limit p_limit
  loop
    select * into v_request from public.subscription_cancellation_requests
    where id = v_target.cancellation_request_id for update;
    select * into v_subscription from public.billing_subscriptions
    where id = v_target.subscription_id and restaurant_id = v_target.restaurant_id for update;
    select * into v_customer from public.billing_customers
    where id = v_subscription.billing_customer_id and restaurant_id = v_target.restaurant_id;
    if v_subscription.id is null or v_customer.id is null or v_subscription.status = 'cancelled'
      or v_subscription.provider <> 'iyzico'
      or (v_request.mode = 'immediate_refund' and v_subscription.status <> 'refund_cancel_pending')
      or (v_request.mode = 'period_end' and not v_subscription.cancel_at_period_end) then
      update public.subscription_cancellation_provider_targets
      set status = 'requires_reconciliation', last_error = 'subscription_cancellation_context_drift'
      where id = v_target.id;
      update public.subscription_cancellation_requests
      set status = 'requires_reconciliation', locked_at = null, locked_by = null,
        last_error = 'subscription_cancellation_context_drift'
      where id = v_request.id;
      continue;
    end if;
    v_fingerprint := encode(extensions.digest(convert_to(
      v_target.restaurant_id::text || E'\n' || v_target.subscription_id::text || E'\n'
      || v_target.id::text || E'\n' || v_target.provider_subscription_ref, 'utf8'), 'sha256'), 'hex');
    insert into public.billing_provider_operations (
      restaurant_id, billing_customer_id, subscription_id, operation_type,
      idempotency_key, request_fingerprint, status, provider_subscription_ref
    ) values (
      v_target.restaurant_id, v_customer.id, v_target.subscription_id,
      'subscription.cancel', 'billing:cancellation-target:' || v_target.id,
      v_fingerprint, 'processing', v_target.provider_subscription_ref
    ) returning * into v_operation;
    update public.subscription_cancellation_provider_targets
    set status = 'processing', provider_operation_id = v_operation.id,
      attempts = attempts + 1, locked_at = p_occurred_at,
      locked_by = btrim(p_worker), last_error = null
    where id = v_target.id returning * into v_target;
    update public.subscription_cancellation_requests
    set status = 'processing', provider_operation_id = v_operation.id,
      attempts = attempts + 1, locked_at = p_occurred_at,
      locked_by = btrim(p_worker), last_error = null
    where id = v_request.id;
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'cancellationRequestId', v_request.id, 'cancellationTargetId', v_target.id,
      'cancellationMode', v_request.mode, 'operationId', v_operation.id,
      'restaurantId', v_target.restaurant_id, 'subscriptionId', v_target.subscription_id,
      'providerSubscriptionRef', v_target.provider_subscription_ref,
      'providerCancelAt', v_request.provider_cancel_at,
      'effectiveAt', v_request.effective_at, 'attempts', v_target.attempts
    ));
  end loop;
  return v_results;
end;
$$;

create function public.complete_subscription_cancellation_provider_cutoff(
  p_cancellation_request_id uuid,
  p_cancellation_target_id uuid,
  p_operation_id uuid,
  p_worker text,
  p_provider_cancelled_at timestamptz,
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
  v_remaining integer;
begin
  select * into v_request from public.subscription_cancellation_requests
  where id = p_cancellation_request_id for update;
  if v_request.id is null then
    raise exception 'billing_cancellation_request_not_found' using errcode = 'P0002';
  end if;
  if v_request.mode = 'immediate_refund' then
    return public.complete_subscription_cancellation_target(
      p_cancellation_request_id, p_cancellation_target_id, p_operation_id,
      p_worker, p_provider_cancelled_at, p_occurred_at
    );
  end if;
  if p_cancellation_target_id is null or p_operation_id is null
    or char_length(btrim(coalesce(p_worker, ''))) not between 1 and 160
    or p_provider_cancelled_at is null or p_occurred_at is null then
    raise exception 'billing_cancellation_complete_input_invalid' using errcode = '22023';
  end if;
  select * into v_target from public.subscription_cancellation_provider_targets
  where id = p_cancellation_target_id and cancellation_request_id = p_cancellation_request_id
  for update;
  if not found then raise exception 'billing_cancellation_target_not_found' using errcode = 'P0002'; end if;
  if v_target.status = 'applied' then
    return jsonb_build_object('cancellationRequestId', v_request.id,
      'subscriptionId', v_request.subscription_id, 'status', v_request.status,
      'requestCompleted', false, 'duplicate', true);
  end if;
  if v_request.mode <> 'period_end' or v_request.status <> 'processing'
    or v_target.status <> 'processing' or v_target.provider_operation_id <> p_operation_id
    or v_target.locked_by <> btrim(p_worker) then
    raise exception 'billing_cancellation_completion_lease_lost' using errcode = '55P03';
  end if;
  select * into v_operation from public.billing_provider_operations
  where id = p_operation_id and operation_type = 'subscription.cancel'
    and subscription_id = v_request.subscription_id
    and restaurant_id = v_request.restaurant_id for update;
  if not found or v_operation.status <> 'processing'
    or v_operation.provider_subscription_ref <> v_target.provider_subscription_ref then
    raise exception 'billing_cancellation_completion_context_invalid' using errcode = 'P0001';
  end if;
  update public.billing_provider_operations set status = 'succeeded',
    result_sanitized = jsonb_build_object(
      'cancelledAt', p_provider_cancelled_at,
      'accessEffectiveAt', v_request.effective_at
    ), completed_at = p_occurred_at, last_error = null where id = v_operation.id;
  update public.subscription_cancellation_provider_targets
  set status = 'applied', provider_cancelled_at = p_provider_cancelled_at,
    applied_at = p_occurred_at, locked_at = null, locked_by = null, last_error = null
  where id = v_target.id;
  select count(*) into v_remaining from public.subscription_cancellation_provider_targets
  where cancellation_request_id = v_request.id and status <> 'applied';
  if v_remaining > 0 then
    update public.subscription_cancellation_requests
    set status = 'processing', locked_at = p_occurred_at, locked_by = btrim(p_worker)
    where id = v_request.id;
    return jsonb_build_object('cancellationRequestId', v_request.id,
      'subscriptionId', v_request.subscription_id, 'status', 'processing',
      'requestCompleted', false, 'duplicate', false);
  end if;
  update public.subscription_cancellation_requests
  set status = 'provider_cancelled', provider_cancelled_at = p_provider_cancelled_at,
      locked_at = null, locked_by = null, last_error = null
  where id = v_request.id;
  return jsonb_build_object('cancellationRequestId', v_request.id,
    'subscriptionId', v_request.subscription_id, 'status', 'provider_cancelled',
    'requestCompleted', false, 'duplicate', false);
end;
$$;

create function public.apply_due_subscription_cancellation_access(
  p_limit integer default 20,
  p_occurred_at timestamptz default clock_timestamp()
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.subscription_cancellation_requests%rowtype;
  v_subscription public.billing_subscriptions%rowtype;
  v_from text;
  v_applied integer := 0;
  v_reconciled integer := 0;
begin
  if p_limit not between 1 and 100 or p_occurred_at is null then
    raise exception 'billing_cancellation_access_input_invalid' using errcode = '22023';
  end if;
  for v_request in
    select request.* from public.subscription_cancellation_requests request
    where request.mode = 'period_end'
      and request.status = 'provider_cancelled'
      and request.effective_at <= p_occurred_at
    order by request.effective_at, request.created_at
    for update skip locked limit p_limit
  loop
    select * into v_subscription from public.billing_subscriptions
    where id = v_request.subscription_id and restaurant_id = v_request.restaurant_id
    for update;
    -- A signed renewal success already waiting for authenticated hydration
    -- must be allowed to acquire the same subscription lock later in this
    -- worker tick. The next access pass will then observe its advanced paid
    -- period and reconcile instead of overwriting it.
    if exists (
      select 1 from public.billing_provider_events event
      where event.subscription_id = v_request.subscription_id
        and event.restaurant_id = v_request.restaurant_id
        and event.event_type = 'invoice.payment_succeeded'
        and event.status in ('received', 'processing', 'failed')
        and event.received_at <= p_occurred_at
    ) then
      continue;
    end if;
    if v_subscription.id is null
      or v_subscription.status = 'cancelled'
      or not v_subscription.cancel_at_period_end
      or v_subscription.current_period_end is distinct from v_request.effective_at
      or exists (
        select 1 from public.subscription_cancellation_provider_targets target
        where target.cancellation_request_id = v_request.id and target.status <> 'applied'
      )
      or exists (
        select 1 from public.billing_provider_events event
        where event.subscription_id = v_request.subscription_id
          and event.restaurant_id = v_request.restaurant_id
          and event.event_type = 'invoice.payment_succeeded'
          and event.status = 'dead_lettered'
          and event.received_at <= p_occurred_at
      ) then
      update public.subscription_cancellation_requests
      set status = 'requires_reconciliation', locked_at = null, locked_by = null,
          last_error = 'period_end_cancellation_renewal_race'
      where id = v_request.id;
      insert into public.billing_reconciliation_jobs (
        restaurant_id, subscription_id, provider, scope, dedupe_key,
        local_snapshot, provider_snapshot_sanitized, discrepancy_code, last_error
      ) values (
        v_request.restaurant_id, v_request.subscription_id, 'iyzico', 'subscription',
        'period-end-cancellation-race:' || v_request.id,
        jsonb_build_object(
          'cancellationRequestId', v_request.id,
          'effectiveAt', v_request.effective_at,
          'currentPeriodEnd', v_subscription.current_period_end,
          'subscriptionStatus', v_subscription.status
        ),
        jsonb_build_object(
          'providerCancelledAt', v_request.provider_cancelled_at,
          'allTargetsCancelled', not exists (
            select 1 from public.subscription_cancellation_provider_targets target
            where target.cancellation_request_id = v_request.id and target.status <> 'applied'
          )
        ),
        'period_end_cancellation_renewal_race',
        'Paid period changed before local period-end access cancellation; access was retained.'
      ) on conflict (dedupe_key) do nothing;
      v_reconciled := v_reconciled + 1;
      continue;
    end if;
    v_from := v_subscription.status;
    update public.billing_subscriptions
    set status = 'cancelled', cancelled_at = v_request.effective_at,
        cancel_at_period_end = false, scheduled_plan = null, version = version + 1
    where id = v_subscription.id;
    update public.restaurants set plan = 'starter' where id = v_request.restaurant_id;
    update public.restaurant_subscription_add_ons
    set status = 'cancelled', cancelled_at = coalesce(cancelled_at, v_request.effective_at)
    where restaurant_id = v_request.restaurant_id
      and subscription_id = v_request.subscription_id and status = 'active';
    update public.billing_subscription_provider_refs
    set ref_role = 'previous', retired_at = coalesce(retired_at, p_occurred_at)
    where subscription_id = v_request.subscription_id and retired_at is null;
    update public.subscription_cancellation_requests
    set status = 'applied', applied_at = p_occurred_at,
        locked_at = null, locked_by = null, last_error = null
    where id = v_request.id;
    insert into public.tenant_lifecycle_events (
      restaurant_id, subscription_id, from_status, to_status, actor_type,
      actor_user_id, reason_code, request_id, occurred_at
    ) values (
      v_request.restaurant_id, v_request.subscription_id, v_from, 'cancelled',
      'system', v_request.requested_by, 'tenant_cancelled_period_end',
      'billing:subscription-cancelled:' || v_request.id, p_occurred_at
    ) on conflict (request_id) do nothing;
    perform public.enqueue_domain_outbox_event(
      v_request.restaurant_id, 'billing_subscription', v_request.id,
      'subscription.cancelled',
      jsonb_build_object('subscriptionId', v_request.subscription_id,
        'cancellationRequestId', v_request.id, 'mode', v_request.mode,
        'effectiveAt', v_request.effective_at,
        'providerCancelledAt', v_request.provider_cancelled_at,
        'semanticVersion', 3),
      'billing:subscription-cancelled:v3:' || v_request.id
    );
    perform public.enqueue_domain_outbox_event(
      v_request.restaurant_id, 'billing_subscription', v_request.subscription_id,
      'subscription.status_changed',
      jsonb_build_object('from', v_from, 'to', 'cancelled',
        'reasonCode', 'tenant_cancelled_period_end'),
      'billing:subscription-cancel-status:v3:' || v_request.id
    );
    v_applied := v_applied + 1;
  end loop;
  return jsonb_build_object('applied', v_applied, 'reconciled', v_reconciled);
end;
$$;

alter function public.read_subscription_billing_settings(uuid)
  rename to read_subscription_billing_settings_before_provider_cutoff;
revoke all on function public.read_subscription_billing_settings_before_provider_cutoff(uuid)
  from public, anon, authenticated, service_role;

create function public.read_subscription_billing_settings(p_restaurant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_settings jsonb;
  v_subscription_id uuid;
  v_cancellation public.subscription_cancellation_requests%rowtype;
begin
  v_settings := public.read_subscription_billing_settings_before_provider_cutoff(p_restaurant_id);
  v_subscription_id := nullif(v_settings #>> '{subscription,id}', '')::uuid;
  if v_subscription_id is not null then
    select * into v_cancellation
    from public.subscription_cancellation_requests cancellation
    where cancellation.restaurant_id = p_restaurant_id
      and cancellation.subscription_id = v_subscription_id
      and cancellation.status in (
        'scheduled', 'processing', 'provider_cancelled', 'requires_reconciliation'
      )
    order by cancellation.created_at desc limit 1;
    v_settings := jsonb_set(v_settings, '{subscription}',
      (v_settings->'subscription') || jsonb_build_object(
        'cancellationRequestId', v_cancellation.id,
        'cancellationEffectiveAt', v_cancellation.effective_at,
        'cancellationStatus', v_cancellation.status
      ), true);
  end if;
  return v_settings;
end;
$$;

revoke all on function public.claim_due_subscription_cancellations(text,integer,integer,timestamptz)
  from service_role;
revoke all on function public.complete_subscription_cancellation_target(
  uuid,uuid,uuid,text,timestamptz,timestamptz
) from service_role;
revoke all on function public.set_subscription_cancellation_provider_cutoff()
  from public, anon, authenticated;
revoke all on function public.claim_subscription_cancellations_before_renewal(
  text,integer,integer,timestamptz
) from public, anon, authenticated;
revoke all on function public.complete_subscription_cancellation_provider_cutoff(
  uuid,uuid,uuid,text,timestamptz,timestamptz
) from public, anon, authenticated;
revoke all on function public.apply_due_subscription_cancellation_access(integer,timestamptz)
  from public, anon, authenticated;
revoke all on function public.reject_subscription_change_during_scheduled_cancellation()
  from public, anon, authenticated;
revoke all on function public.read_subscription_billing_settings(uuid)
  from public, anon, authenticated;

grant execute on function public.claim_subscription_cancellations_before_renewal(
  text,integer,integer,timestamptz
) to service_role;
grant execute on function public.complete_subscription_cancellation_provider_cutoff(
  uuid,uuid,uuid,text,timestamptz,timestamptz
) to service_role;
grant execute on function public.apply_due_subscription_cancellation_access(integer,timestamptz)
  to service_role;
grant execute on function public.read_subscription_billing_settings(uuid) to service_role;

comment on function public.apply_due_subscription_cancellation_access(integer,timestamptz) is
  'At the paid-period boundary, cancels local access only if the locked period still matches; a concurrent paid renewal wins and is quarantined for reconciliation.';

commit;
