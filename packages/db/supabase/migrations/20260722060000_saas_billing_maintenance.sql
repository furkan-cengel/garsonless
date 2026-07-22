-- Faz 5.6: leased SaaS billing dunning/reconciliation workers and mandatory
-- tenant notification events. Service-role only; no tenant data is changed by
-- installing this migration until the maintenance worker claims due rows.

alter table public.dunning_runs
  add column locked_at timestamptz,
  add column locked_by text check (locked_by is null or char_length(locked_by) <= 160);

alter table public.domain_outbox drop constraint if exists domain_outbox_aggregate_type_check;
alter table public.domain_outbox add constraint domain_outbox_aggregate_type_check
  check (aggregate_type in (
    'order', 'table_session', 'service_request', 'customer', 'campaign',
    'billing_subscription', 'billing_invoice', 'billing_reconciliation'
  ));

alter table public.domain_outbox drop constraint if exists domain_outbox_event_type_check;
alter table public.domain_outbox add constraint domain_outbox_event_type_check
  check (event_type in (
    'order.created', 'order.status_changed', 'order.settled',
    'table_session.closed', 'service_request.created',
    'customer.welcome_bonus_requested', 'campaign.delivery_requested',
    'subscription.trial_started', 'subscription.status_changed',
    'invoice.created', 'invoice.payment_failed', 'invoice.paid',
    'billing.retry_requested', 'billing.warning_3', 'billing.warning_7',
    'billing.reconciliation_required',
    'tenant.suspended', 'tenant.reactivated'
  ));

-- Every ambiguous outbound provider operation must enter the durable
-- reconciliation queue. The operation ledger remains the idempotency source;
-- this job only makes the ambiguity claimable and visible to operators.
create or replace function public.mark_subscription_billing_operation_reconciliation(
  p_operation_id uuid,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_operation public.billing_provider_operations%rowtype;
begin
  select * into v_operation
  from public.billing_provider_operations
  where id = p_operation_id
  for update;
  if not found then
    raise exception 'billing_operation_not_found' using errcode = 'P0002';
  end if;
  if v_operation.status in ('processing', 'awaiting_callback') then
    update public.billing_provider_operations
    set status = 'requires_reconciliation', last_error = left(coalesce(p_reason, 'provider_result_ambiguous'), 1000)
    where id = p_operation_id;
  elsif v_operation.status <> 'requires_reconciliation' then
    raise exception 'billing_operation_not_reconcilable' using errcode = '55000';
  end if;

  insert into public.billing_reconciliation_jobs (
    restaurant_id, subscription_id, provider, scope, dedupe_key,
    local_snapshot, provider_snapshot_sanitized
  ) values (
    v_operation.restaurant_id, v_operation.subscription_id, v_operation.provider,
    case when v_operation.invoice_id is null then 'subscription' else 'invoice' end,
    'provider-operation:' || v_operation.id,
    jsonb_build_object(
      'operationId', v_operation.id,
      'operationType', v_operation.operation_type,
      'invoiceId', v_operation.invoice_id
    ),
    '{}'::jsonb
  ) on conflict (dedupe_key) do nothing;
  return true;
end;
$$;

create or replace function public.claim_billing_dunning(
  p_worker text,
  p_limit integer default 20,
  p_lease_seconds integer default 60
)
returns table (
  run_id uuid,
  restaurant_id uuid,
  subscription_id uuid,
  invoice_id uuid,
  step text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if char_length(btrim(coalesce(p_worker, ''))) not between 1 and 160
    or p_limit not between 1 and 100
    or p_lease_seconds not between 1 and 3600 then
    raise exception 'invalid_billing_dunning_claim' using errcode = '22023';
  end if;

  return query
  with candidates as (
    select run.id
    from public.dunning_runs run
    where run.next_action_at <= now()
      and (
        run.status in ('scheduled', 'failed')
        or (run.status = 'running' and run.locked_at < now() - make_interval(secs => p_lease_seconds))
      )
    order by run.next_action_at, run.created_at
    for update skip locked
    limit p_limit
  ), claimed as (
    update public.dunning_runs run
    set status = 'running', locked_at = now(), locked_by = p_worker,
        attempts = run.attempts + 1, last_error = null
    from candidates
    where run.id = candidates.id
    returning run.*
  )
  select claimed.id, claimed.restaurant_id, claimed.subscription_id,
         claimed.invoice_id, claimed.current_step
  from claimed;
end;
$$;

create or replace function public.advance_billing_dunning(
  p_run_id uuid,
  p_worker text,
  p_completed_step text,
  p_occurred_at timestamptz
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_run public.dunning_runs%rowtype;
  v_invoice public.subscription_invoices%rowtype;
  v_subscription public.billing_subscriptions%rowtype;
  v_failed_at timestamptz;
  v_next_step text;
  v_next_at timestamptz;
  v_event_type text;
  v_from_status text;
begin
  if p_completed_step not in ('retry', 'warning_3', 'warning_7', 'suspend')
    or p_occurred_at is null then
    raise exception 'invalid_billing_dunning_advance' using errcode = '22023';
  end if;

  select * into v_run from public.dunning_runs where id = p_run_id for update;
  if not found or v_run.status <> 'running' or v_run.locked_by is distinct from p_worker
    or v_run.current_step <> p_completed_step then
    raise exception 'billing_dunning_lease_lost' using errcode = '55000';
  end if;
  select * into v_invoice from public.subscription_invoices where id = v_run.invoice_id for update;
  select * into v_subscription from public.billing_subscriptions where id = v_run.subscription_id for update;

  if v_invoice.status = 'paid' or v_subscription.status in ('cancelled', 'manual_hold') then
    update public.dunning_runs
    set status = 'stopped', next_action_at = null, last_action_at = p_occurred_at,
        locked_at = null, locked_by = null, last_error = null
    where id = p_run_id;
    return 'stopped';
  end if;
  if v_invoice.status <> 'past_due' then
    raise exception 'billing_dunning_invoice_not_past_due' using errcode = '55000';
  end if;

  v_failed_at := coalesce(v_invoice.failed_at, v_run.created_at);
  if p_completed_step = 'retry' then
    v_event_type := 'billing.retry_requested';
    v_next_step := 'warning_3';
    v_next_at := v_failed_at + make_interval(days => (v_run.policy_snapshot->>'secondWarningAfterDays')::integer);
  elsif p_completed_step = 'warning_3' then
    v_event_type := 'billing.warning_3';
    v_next_step := 'warning_7';
    v_next_at := v_failed_at + make_interval(days => (v_run.policy_snapshot->>'finalWarningAfterDays')::integer);
  elsif p_completed_step = 'warning_7' then
    v_event_type := 'billing.warning_7';
    v_next_step := 'suspend';
    v_next_at := v_failed_at + make_interval(days => (v_run.policy_snapshot->>'suspendAfterDays')::integer);
    if v_subscription.status = 'past_due' then
      v_from_status := v_subscription.status;
      update public.billing_subscriptions
      set status = 'grace_period', grace_ends_at = v_next_at, version = version + 1
      where id = v_subscription.id;
      insert into public.tenant_lifecycle_events (
        restaurant_id, subscription_id, from_status, to_status, actor_type,
        reason_code, request_id, metadata, occurred_at
      ) values (
        v_run.restaurant_id, v_run.subscription_id, v_from_status, 'grace_period', 'system',
        'dunning_final_warning', 'dunning:' || v_run.id || ':grace',
        jsonb_build_object('invoiceId', v_run.invoice_id), p_occurred_at
      ) on conflict (request_id) do nothing;
      perform public.enqueue_domain_outbox_event(
        v_run.restaurant_id, 'billing_subscription', v_run.subscription_id,
        'subscription.status_changed',
        jsonb_build_object('from', v_from_status, 'to', 'grace_period', 'reasonCode', 'dunning_final_warning'),
        'dunning:' || v_run.id || ':status:grace'
      );
    end if;
  else
    v_from_status := v_subscription.status;
    if v_from_status not in ('past_due', 'grace_period') then
      update public.dunning_runs
      set status = 'stopped', next_action_at = null, last_action_at = p_occurred_at,
          locked_at = null, locked_by = null, last_error = null
      where id = p_run_id;
      return 'stopped';
    end if;
    update public.billing_subscriptions
    set status = 'suspended', suspended_at = p_occurred_at, grace_ends_at = null,
        version = version + 1
    where id = v_subscription.id;
    update public.restaurants set plan = 'free' where id = v_run.restaurant_id;
    insert into public.tenant_lifecycle_events (
      restaurant_id, subscription_id, from_status, to_status, actor_type,
      reason_code, request_id, metadata, occurred_at
    ) values (
      v_run.restaurant_id, v_run.subscription_id, v_from_status, 'suspended', 'system',
      'dunning_exhausted', 'dunning:' || v_run.id || ':suspend',
      jsonb_build_object('invoiceId', v_run.invoice_id), p_occurred_at
    ) on conflict (request_id) do nothing;
    perform public.enqueue_domain_outbox_event(
      v_run.restaurant_id, 'billing_subscription', v_run.subscription_id,
      'subscription.status_changed',
      jsonb_build_object('from', v_from_status, 'to', 'suspended', 'reasonCode', 'dunning_exhausted'),
      'dunning:' || v_run.id || ':status:suspended'
    );
    perform public.enqueue_domain_outbox_event(
      v_run.restaurant_id, 'billing_subscription', v_run.subscription_id,
      'tenant.suspended', jsonb_build_object('reasonCode', 'dunning_exhausted'),
      'dunning:' || v_run.id || ':tenant-suspended'
    );
    update public.dunning_runs
    set status = 'completed', next_action_at = null, last_action_at = p_occurred_at,
        locked_at = null, locked_by = null, last_error = null
    where id = p_run_id;
    return 'completed';
  end if;

  perform public.enqueue_domain_outbox_event(
    v_run.restaurant_id, 'billing_invoice', v_run.invoice_id, v_event_type,
    jsonb_build_object(
      'subscriptionId', v_run.subscription_id,
      'dunningRunId', v_run.id,
      'amountMinor', v_invoice.amount_due_minor,
      'currency', v_invoice.currency,
      'dueAt', v_invoice.due_at
    ),
    'dunning:' || v_run.id || ':' || p_completed_step
  );
  update public.dunning_runs
  set status = 'scheduled', current_step = v_next_step, next_action_at = v_next_at,
      last_action_at = p_occurred_at, locked_at = null, locked_by = null, last_error = null
  where id = p_run_id;
  return 'advanced';
end;
$$;

create or replace function public.fail_billing_dunning(
  p_run_id uuid,
  p_worker text,
  p_reason text,
  p_retry_delay_seconds integer default 60
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.dunning_runs
  set status = 'failed', next_action_at = now() + make_interval(secs => greatest(1, least(p_retry_delay_seconds, 3600))),
      last_error = left(coalesce(p_reason, 'billing_dunning_failed'), 1000),
      locked_at = null, locked_by = null
  where id = p_run_id and status = 'running' and locked_by = p_worker;
  return found;
end;
$$;

create or replace function public.claim_billing_reconciliation(
  p_worker text,
  p_limit integer default 20,
  p_lease_seconds integer default 60
)
returns table (job_id uuid, restaurant_id uuid, subscription_id uuid, scope text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if char_length(btrim(coalesce(p_worker, ''))) not between 1 and 160
    or p_limit not between 1 and 100 or p_lease_seconds not between 1 and 3600 then
    raise exception 'invalid_billing_reconciliation_claim' using errcode = '22023';
  end if;

  -- A process may die after claiming the local operation but before recording
  -- the provider result. Never redispatch such an operation automatically:
  -- quarantine stale claims and create one manual-review job instead.
  update public.billing_provider_operations
  set status = 'requires_reconciliation', last_error = 'stale_provider_operation'
  where (
      status = 'processing' and updated_at < now() - interval '15 minutes'
    ) or (
      status = 'awaiting_callback' and updated_at < now() - interval '24 hours'
    );

  insert into public.billing_reconciliation_jobs (
    restaurant_id, subscription_id, provider, scope, dedupe_key,
    local_snapshot, provider_snapshot_sanitized
  )
  select operation.restaurant_id, operation.subscription_id, operation.provider,
    case when operation.invoice_id is null then 'subscription' else 'invoice' end,
    'provider-operation:' || operation.id,
    jsonb_build_object(
      'operationId', operation.id,
      'operationType', operation.operation_type,
      'invoiceId', operation.invoice_id
    ),
    '{}'::jsonb
  from public.billing_provider_operations operation
  where operation.status = 'requires_reconciliation'
  on conflict (dedupe_key) do nothing;

  return query
  with candidates as (
    select job.id
    from public.billing_reconciliation_jobs job
    where job.scheduled_at <= now()
      and (job.status in ('pending', 'failed')
        or (job.status = 'running' and job.locked_at < now() - make_interval(secs => p_lease_seconds)))
    order by job.scheduled_at, job.created_at
    for update skip locked
    limit p_limit
  ), claimed as (
    update public.billing_reconciliation_jobs job
    set status = 'running', started_at = coalesce(job.started_at, now()),
        locked_at = now(), locked_by = p_worker, attempts = job.attempts + 1,
        last_error = null
    from candidates where job.id = candidates.id
    returning job.*
  )
  select claimed.id, claimed.restaurant_id, claimed.subscription_id, claimed.scope from claimed;
end;
$$;

create or replace function public.escalate_billing_reconciliation(
  p_job_id uuid,
  p_worker text,
  p_discrepancy_code text,
  p_occurred_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job public.billing_reconciliation_jobs%rowtype;
begin
  if p_discrepancy_code <> 'manual_review_required' then
    raise exception 'invalid_billing_reconciliation_discrepancy' using errcode = '22023';
  end if;
  select * into v_job from public.billing_reconciliation_jobs where id = p_job_id for update;
  if not found or v_job.status <> 'running' or v_job.locked_by is distinct from p_worker then
    return false;
  end if;
  update public.billing_reconciliation_jobs
  set status = 'discrepancy', discrepancy_code = p_discrepancy_code,
      completed_at = p_occurred_at, locked_at = null, locked_by = null, last_error = null
  where id = p_job_id;
  if v_job.restaurant_id is not null then
    perform public.enqueue_domain_outbox_event(
      v_job.restaurant_id, 'billing_reconciliation', v_job.id,
      'billing.reconciliation_required',
      jsonb_build_object('scope', v_job.scope),
      'billing-reconciliation:' || v_job.id || ':required'
    );
  end if;
  return true;
end;
$$;

create or replace function public.fail_billing_reconciliation(
  p_job_id uuid,
  p_worker text,
  p_reason text,
  p_retry_delay_seconds integer default 60
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.billing_reconciliation_jobs
  set status = 'failed', scheduled_at = now() + make_interval(secs => greatest(1, least(p_retry_delay_seconds, 3600))),
      last_error = left(coalesce(p_reason, 'billing_reconciliation_failed'), 1000),
      locked_at = null, locked_by = null
  where id = p_job_id and status = 'running' and locked_by = p_worker;
  return found;
end;
$$;

revoke all on function public.claim_billing_dunning(text,integer,integer) from public, anon, authenticated;
revoke all on function public.advance_billing_dunning(uuid,text,text,timestamptz) from public, anon, authenticated;
revoke all on function public.fail_billing_dunning(uuid,text,text,integer) from public, anon, authenticated;
revoke all on function public.claim_billing_reconciliation(text,integer,integer) from public, anon, authenticated;
revoke all on function public.escalate_billing_reconciliation(uuid,text,text,timestamptz) from public, anon, authenticated;
revoke all on function public.fail_billing_reconciliation(uuid,text,text,integer) from public, anon, authenticated;
revoke all on function public.mark_subscription_billing_operation_reconciliation(uuid,text) from public, anon, authenticated;
grant execute on function public.claim_billing_dunning(text,integer,integer) to service_role;
grant execute on function public.advance_billing_dunning(uuid,text,text,timestamptz) to service_role;
grant execute on function public.fail_billing_dunning(uuid,text,text,integer) to service_role;
grant execute on function public.claim_billing_reconciliation(text,integer,integer) to service_role;
grant execute on function public.escalate_billing_reconciliation(uuid,text,text,timestamptz) to service_role;
grant execute on function public.fail_billing_reconciliation(uuid,text,text,integer) to service_role;
grant execute on function public.mark_subscription_billing_operation_reconciliation(uuid,text) to service_role;

comment on function public.advance_billing_dunning(uuid,text,text,timestamptz)
  is 'Lease-bound and replay-safe dunning state transition; provider retry acceptance never marks an invoice paid.';
comment on function public.escalate_billing_reconciliation(uuid,text,text,timestamptz)
  is 'Makes an ambiguous billing state visible for manual review; never auto-heals money state.';
