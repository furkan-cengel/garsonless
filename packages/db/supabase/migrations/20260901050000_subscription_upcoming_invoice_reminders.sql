-- Faz 2: enqueue one mandatory D-N renewal reminder for each active provider
-- subscription period. The platform policy owns N (default D-3). This
-- scheduler records no invoice and never infers a provider payment outcome.

alter table public.domain_outbox drop constraint if exists domain_outbox_event_type_check;
alter table public.domain_outbox add constraint domain_outbox_event_type_check
  check (event_type in (
    'order.created', 'order.status_changed', 'order.settled',
    'table_session.closed', 'service_request.created',
    'customer.welcome_bonus_requested', 'campaign.delivery_requested',
    'subscription.trial_started', 'subscription.status_changed',
    'invoice.created', 'invoice.upcoming', 'invoice.payment_failed', 'invoice.paid',
    'billing.retry_requested', 'billing.warning_3', 'billing.warning_7',
    'billing.reconciliation_required',
    'tenant.suspended', 'tenant.reactivated'
  ));

create or replace function public.enqueue_subscription_upcoming_invoice_reminders(
  p_limit integer default 100,
  p_occurred_at timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_reminder_days integer;
  v_enqueued integer;
begin
  if p_limit not between 1 and 1000 or p_occurred_at is null then
    raise exception 'invalid_subscription_upcoming_reminder_batch' using errcode = '22023';
  end if;

  select policy.pre_due_reminder_days into strict v_reminder_days
  from public.billing_platform_policies policy
  where policy.id = 'default';

  with candidates as (
    select
      subscription.id,
      subscription.restaurant_id,
      subscription.plan,
      subscription.billing_interval,
      subscription.current_period_start,
      subscription.current_period_end
    from public.billing_subscriptions subscription
    where subscription.provider = 'iyzico'
      and subscription.provider_subscription_ref is not null
      and subscription.status = 'active'
      and subscription.cancel_at_period_end = false
      and subscription.current_period_start is not null
      and subscription.current_period_end > p_occurred_at
      and subscription.current_period_end <= p_occurred_at + make_interval(days => v_reminder_days)
    order by subscription.current_period_end, subscription.id
    limit p_limit
  ), enqueued as (
    insert into public.domain_outbox (
      restaurant_id, aggregate_type, aggregate_id, event_type,
      payload, idempotency_key, occurred_at, available_at
    )
    select
      candidate.restaurant_id,
      'billing_subscription',
      candidate.id,
      'invoice.upcoming',
      jsonb_build_object(
        'plan', candidate.plan,
        'billingInterval', candidate.billing_interval,
        'periodStart', candidate.current_period_start,
        'periodEnd', candidate.current_period_end,
        'reminderDays', v_reminder_days,
        'semanticVersion', 1
      ),
      'billing:invoice-upcoming:v1:' || candidate.id || ':'
        || extract(epoch from candidate.current_period_end)::bigint,
      p_occurred_at,
      p_occurred_at
    from candidates candidate
    on conflict (idempotency_key) do nothing
    returning 1
  )
  select count(*)::integer into v_enqueued from enqueued;

  return v_enqueued;
end;
$$;

revoke all on function public.enqueue_subscription_upcoming_invoice_reminders(integer,timestamptz)
  from public, anon, authenticated;
grant execute on function public.enqueue_subscription_upcoming_invoice_reminders(integer,timestamptz)
  to service_role;

comment on function public.enqueue_subscription_upcoming_invoice_reminders(integer,timestamptz) is
  'Idempotently enqueues one mandatory invoice.upcoming notification per active provider subscription period inside the configured pre-due window; never creates invoices or changes payment/access state.';
