-- Faz 6.5a: finance/superadmin-only safe billing operations timeline.
-- The projection deliberately omits PII, provider references, payloads,
-- idempotency keys, fingerprints and internal error text.

create or replace function public.read_platform_admin_tenant_billing_timeline(
  p_restaurant_id uuid,
  p_actor_user_id uuid,
  p_actor_role text,
  p_limit integer default 50
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_identity public.platform_admin_users%rowtype;
  v_result jsonb;
begin
  if p_limit not between 1 and 100 then
    raise exception 'platform_billing_timeline_limit_invalid' using errcode = '22023';
  end if;

  select * into v_identity
  from public.platform_admin_users
  where user_id = p_actor_user_id;
  if not found
    or v_identity.status <> 'active'
    or v_identity.role <> p_actor_role
    or v_identity.role not in ('finance', 'superadmin') then
    raise exception 'platform_billing_timeline_not_authorized' using errcode = '42501';
  end if;

  perform 1 from public.restaurants where id = p_restaurant_id;
  if not found then
    raise exception 'platform_tenant_not_found' using errcode = 'P0002';
  end if;

  with timeline as (
    select
      i.id,
      'invoice'::text as kind,
      i.status,
      'invoice'::text as action,
      i.created_at as occurred_at,
      i.id as invoice_id,
      i.amount_due_minor as amount_minor,
      i.currency,
      null::integer as attempt,
      i.due_at as next_action_at,
      coalesce(i.paid_at, i.failed_at) as completed_at,
      i.status in ('past_due', 'uncollectible') as has_error
    from public.subscription_invoices i
    where i.restaurant_id = p_restaurant_id

    union all

    select
      a.id,
      'payment_attempt',
      a.status,
      'payment.attempt',
      a.attempted_at,
      a.invoice_id,
      a.amount_minor,
      a.currency,
      a.attempt_number,
      null::timestamptz,
      a.completed_at,
      a.status = 'failed'
    from public.subscription_payment_attempts a
    where a.restaurant_id = p_restaurant_id

    union all

    select
      d.id,
      'dunning',
      d.status,
      d.current_step,
      d.created_at,
      d.invoice_id,
      null::bigint,
      null::text,
      d.attempts,
      d.next_action_at,
      case when d.status in ('completed', 'stopped') then d.last_action_at else null end,
      d.status = 'failed'
    from public.dunning_runs d
    where d.restaurant_id = p_restaurant_id

    union all

    select
      r.id,
      'reconciliation',
      r.status,
      r.scope,
      r.created_at,
      null::uuid,
      null::bigint,
      null::text,
      r.attempts,
      r.scheduled_at,
      r.completed_at,
      r.status in ('discrepancy', 'failed')
    from public.billing_reconciliation_jobs r
    where r.restaurant_id = p_restaurant_id

    union all

    select
      e.id,
      'provider_event',
      e.status,
      e.event_type,
      e.received_at,
      null::uuid,
      null::bigint,
      null::text,
      e.attempts,
      e.available_at,
      e.processed_at,
      e.status in ('failed', 'dead_lettered')
    from public.billing_provider_events e
    where e.restaurant_id = p_restaurant_id

    union all

    select
      o.id,
      'provider_operation',
      o.status,
      o.operation_type,
      o.created_at,
      o.invoice_id,
      o.amount_minor,
      o.currency,
      o.attempts,
      o.due_at,
      o.completed_at,
      o.status = 'requires_reconciliation'
    from public.billing_provider_operations o
    where o.restaurant_id = p_restaurant_id
  ), limited as (
    select * from timeline
    order by occurred_at desc, kind, id
    limit p_limit
  )
  select jsonb_build_object(
    'summary', jsonb_build_object(
      'outstandingMinor', coalesce((
        select sum(greatest(amount_due_minor - amount_paid_minor, 0))
        from public.subscription_invoices
        where restaurant_id = p_restaurant_id and status in ('open', 'past_due')
      ), 0),
      'currency', 'TRY',
      'openInvoices', (
        select count(*) from public.subscription_invoices
        where restaurant_id = p_restaurant_id and status in ('open', 'past_due')
      ),
      'activeDunning', (
        select count(*) from public.dunning_runs
        where restaurant_id = p_restaurant_id and status in ('scheduled', 'running', 'failed')
      ),
      'openReconciliation', (
        select count(*) from public.billing_reconciliation_jobs
        where restaurant_id = p_restaurant_id and status in ('pending', 'running', 'discrepancy', 'failed')
      ),
      'failedAttempts', (
        select count(*) from public.subscription_payment_attempts
        where restaurant_id = p_restaurant_id and status = 'failed'
      )
    ),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id,
        'kind', kind,
        'status', status,
        'action', action,
        'occurredAt', occurred_at,
        'invoiceId', invoice_id,
        'amountMinor', amount_minor,
        'currency', currency,
        'attempt', attempt,
        'nextActionAt', next_action_at,
        'completedAt', completed_at,
        'hasError', has_error
      ) order by occurred_at desc, kind, id)
      from limited
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.read_platform_admin_tenant_billing_timeline(uuid,uuid,text,integer)
  from public, anon, authenticated;
grant execute on function public.read_platform_admin_tenant_billing_timeline(uuid,uuid,text,integer)
  to service_role;

comment on function public.read_platform_admin_tenant_billing_timeline(uuid,uuid,text,integer) is
  'Finance/superadmin-only bounded billing operations projection without PII, provider references or raw diagnostics.';
