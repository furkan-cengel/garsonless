-- Faz 6.5b: finance/superadmin-only audited dunning scheduling controls.
-- These controls never mark an invoice paid, activate an entitlement or call a
-- payment provider. They only change when the existing leased worker may claim
-- an already-past-due invoice. Signed provider webhooks remain payment authority.

create or replace function public.intervene_platform_admin_billing_dunning(
  p_restaurant_id uuid,
  p_invoice_id uuid,
  p_actor_user_id uuid,
  p_actor_role text,
  p_intervention text,
  p_defer_days integer,
  p_reason text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_identity public.platform_admin_users%rowtype;
  v_invoice public.subscription_invoices%rowtype;
  v_subscription public.billing_subscriptions%rowtype;
  v_run public.dunning_runs%rowtype;
  v_previous_status text;
  v_previous_next_action_at timestamptz;
  v_next_action_at timestamptz;
  v_action text;
  v_changed boolean;
  v_after jsonb;
  v_existing_after jsonb;
begin
  if coalesce(p_intervention, '') not in ('retry_now', 'defer') then
    raise exception 'platform_dunning_intervention_invalid' using errcode = '22023';
  end if;
  if p_intervention = 'defer' and (p_defer_days is null or p_defer_days not between 1 and 30) then
    raise exception 'platform_dunning_defer_period_invalid' using errcode = '22023';
  end if;
  if p_intervention = 'retry_now' and p_defer_days is not null then
    raise exception 'platform_dunning_retry_period_invalid' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) not between 10 and 1000 then
    raise exception 'platform_dunning_reason_invalid' using errcode = '22023';
  end if;
  if p_request_id is null then
    raise exception 'platform_dunning_request_invalid' using errcode = '22023';
  end if;

  select * into v_identity
  from public.platform_admin_users
  where user_id = p_actor_user_id
  for update;
  if not found
    or v_identity.status <> 'active'
    or v_identity.role <> p_actor_role
    or v_identity.role not in ('finance', 'superadmin') then
    raise exception 'platform_dunning_not_authorized' using errcode = '42501';
  end if;

  v_action := case p_intervention
    when 'retry_now' then 'billing.dunning.retry_now'
    else 'billing.dunning.defer'
  end;

  select after_state into v_existing_after
  from public.platform_admin_audit_log
  where actor_user_id = p_actor_user_id
    and request_id = p_request_id
    and action = v_action
    and target_type = 'billing_invoice'
    and target_id = p_invoice_id::text;
  if found then
    return v_existing_after || jsonb_build_object('duplicate', true);
  end if;

  perform 1
  from public.restaurants
  where id = p_restaurant_id and deleted_at is null
  for update;
  if not found then
    raise exception 'platform_tenant_not_found' using errcode = 'P0002';
  end if;

  select * into v_invoice
  from public.subscription_invoices
  where id = p_invoice_id and restaurant_id = p_restaurant_id
  for update;
  if not found then
    raise exception 'platform_invoice_not_found' using errcode = 'P0002';
  end if;

  select * into v_subscription
  from public.billing_subscriptions
  where id = v_invoice.subscription_id and restaurant_id = p_restaurant_id
  for update;

  select * into v_run
  from public.dunning_runs
  where invoice_id = p_invoice_id and restaurant_id = p_restaurant_id
  for update;
  if not found
    or v_invoice.status <> 'past_due'
    or v_subscription.status not in ('past_due', 'grace_period')
    or v_run.status in ('completed', 'stopped') then
    raise exception 'platform_dunning_not_actionable' using errcode = '55000';
  end if;
  if v_run.status = 'running' or v_run.locked_at is not null or v_run.locked_by is not null then
    raise exception 'platform_dunning_run_busy' using errcode = '55000';
  end if;

  v_previous_status := v_run.status;
  v_previous_next_action_at := v_run.next_action_at;
  if p_intervention = 'retry_now' then
    v_next_action_at := now();
  else
    -- An exemption may only move work later, never accidentally accelerate it.
    v_next_action_at := greatest(
      coalesce(v_run.next_action_at, now()),
      now() + make_interval(days => p_defer_days)
    );
  end if;

  v_changed := v_run.status <> 'scheduled'
    or v_run.next_action_at is distinct from v_next_action_at;

  update public.dunning_runs
  set status = 'scheduled',
      next_action_at = v_next_action_at,
      locked_at = null,
      locked_by = null
  where id = v_run.id;

  v_after := jsonb_build_object(
    'restaurantId', p_restaurant_id,
    'invoiceId', p_invoice_id,
    'runId', v_run.id,
    'intervention', p_intervention,
    'previousStatus', v_previous_status,
    'status', 'scheduled',
    'previousNextActionAt', v_previous_next_action_at,
    'nextActionAt', v_next_action_at,
    'changed', v_changed,
    'duplicate', false,
    'requestId', p_request_id
  );

  insert into public.platform_admin_audit_log (
    actor_user_id, actor_role, action, target_type, target_id,
    reason, request_id, before_state, after_state
  ) values (
    p_actor_user_id, v_identity.role, v_action, 'billing_invoice', p_invoice_id::text,
    btrim(p_reason), p_request_id,
    jsonb_build_object(
      'restaurantId', p_restaurant_id,
      'invoiceId', p_invoice_id,
      'runId', v_run.id,
      'status', v_previous_status,
      'currentStep', v_run.current_step,
      'nextActionAt', v_previous_next_action_at
    ),
    v_after
  );

  return v_after;
end;
$$;

revoke all on function public.intervene_platform_admin_billing_dunning(uuid,uuid,uuid,text,text,integer,text,uuid)
  from public, anon, authenticated;
grant execute on function public.intervene_platform_admin_billing_dunning(uuid,uuid,uuid,text,text,integer,text,uuid)
  to service_role;

comment on function public.intervene_platform_admin_billing_dunning(uuid,uuid,uuid,text,text,integer,text,uuid) is
  'Finance/superadmin-only audited dunning scheduling control; never marks paid, grants entitlements or dispatches provider calls.';
