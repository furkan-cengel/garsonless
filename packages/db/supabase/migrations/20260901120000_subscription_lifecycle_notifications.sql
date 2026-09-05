-- Phase 6a: transactional subscription lifecycle notifications, consent-aware
-- onboarding reminders, fiscal-document delivery receipts and Resend provider
-- outcome visibility. Provider/payment state is never inferred from e-mail.

begin;

alter table public.domain_outbox drop constraint if exists domain_outbox_aggregate_type_check;
alter table public.domain_outbox add constraint domain_outbox_aggregate_type_check
  check (aggregate_type in (
    'order', 'table_session', 'service_request', 'customer', 'campaign', 'onboarding',
    'billing_subscription', 'billing_invoice', 'billing_reconciliation', 'billing_refund'
  ));

alter table public.domain_outbox drop constraint if exists domain_outbox_event_type_check;
alter table public.domain_outbox add constraint domain_outbox_event_type_check
  check (event_type in (
    'order.created', 'order.status_changed', 'order.settled',
    'table_session.closed', 'service_request.created',
    'customer.welcome_bonus_requested', 'campaign.delivery_requested',
    'onboarding.incomplete',
    'subscription.trial_started', 'subscription.trial_expiring_7',
    'subscription.trial_expiring_3', 'subscription.trial_expiring_1',
    'subscription.trial_expired', 'subscription.status_changed',
    'subscription.cancellation_scheduled', 'subscription.cancellation_withdrawn',
    'subscription.cancelled',
    'invoice.created', 'invoice.upcoming', 'invoice.payment_failed', 'invoice.paid',
    'billing.retry_requested', 'billing.warning_3', 'billing.warning_7',
    'billing.reconciliation_required',
    'plan.change_scheduled', 'plan.changed', 'payment_method.updated',
    'refund.requested', 'refund.succeeded', 'refund.failed',
    'fiscal_document.ready',
    'tenant.suspended', 'tenant.reactivated'
  ));

alter table public.notification_templates drop constraint if exists notification_templates_category_check;
alter table public.notification_templates add constraint notification_templates_category_check
  check (category in ('order', 'service_request', 'lifecycle', 'billing', 'system'));
alter table public.notification_deliveries drop constraint if exists notification_deliveries_category_check;
alter table public.notification_deliveries add constraint notification_deliveries_category_check
  check (category in ('order', 'service_request', 'lifecycle', 'billing', 'system'));

alter table public.notification_deliveries
  add column provider_delivery_status text,
  add column provider_event_at timestamptz;
alter table public.notification_deliveries
  add constraint notification_deliveries_provider_status_check check (
    provider_delivery_status is null or provider_delivery_status in (
      'sent', 'delivered', 'delivery_delayed', 'opened', 'clicked',
      'bounced', 'complained', 'suppressed', 'failed'
    )
  );

create table public.notification_delivery_provider_events (
  webhook_id text primary key check (char_length(btrim(webhook_id)) between 1 and 200),
  notification_delivery_id uuid not null
    references public.notification_deliveries(id) on delete cascade,
  provider_message_id text not null check (char_length(btrim(provider_message_id)) between 1 and 200),
  event_type text not null check (event_type in (
    'sent', 'delivered', 'delivery_delayed', 'opened', 'clicked',
    'bounced', 'complained', 'suppressed', 'failed'
  )),
  occurred_at timestamptz not null,
  created_at timestamptz not null default clock_timestamp()
);
create index notification_delivery_provider_events_delivery_idx
  on public.notification_delivery_provider_events(notification_delivery_id, occurred_at desc);
alter table public.notification_delivery_provider_events enable row level security;
alter table public.notification_delivery_provider_events force row level security;
revoke all on public.notification_delivery_provider_events from public, anon, authenticated;
grant select, insert on public.notification_delivery_provider_events to service_role;

create function public.enqueue_subscription_trial_lifecycle_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' and new.status = 'trial' then
    perform public.enqueue_domain_outbox_event(
      new.restaurant_id, 'billing_subscription', new.id, 'subscription.trial_started',
      jsonb_build_object(
        'trialEndsAt', new.trial_ends_at,
        'intendedPlan', new.intended_plan,
        'semanticVersion', 1
      ),
      'billing:trial-started:v1:' || new.id
    );
  elsif tg_op = 'UPDATE' and old.status = 'trial' and new.status = 'trial_expired' then
    perform public.enqueue_domain_outbox_event(
      new.restaurant_id, 'billing_subscription', new.id, 'subscription.trial_expired',
      jsonb_build_object('trialEndsAt', new.trial_ends_at, 'semanticVersion', 1),
      'billing:trial-expired:v1:' || new.id
    );
  end if;
  return new;
end;
$$;

create trigger billing_subscription_trial_lifecycle_notification
  after insert or update of status on public.billing_subscriptions
  for each row execute function public.enqueue_subscription_trial_lifecycle_event();

create function public.enqueue_subscription_lifecycle_notifications(
  p_limit integer default 100,
  p_occurred_at timestamptz default clock_timestamp()
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_trial record;
  v_onboarding record;
  v_event_type text;
  v_key text;
  v_event_id uuid;
  v_trial_reminders integer := 0;
  v_onboarding_reminders integer := 0;
  v_expired_trials integer := 0;
begin
  if p_limit not between 1 and 500 or p_occurred_at is null then
    raise exception 'billing_lifecycle_notification_input_invalid' using errcode = '22023';
  end if;

  for v_trial in
    select subscription.*
    from public.billing_subscriptions subscription
    join public.restaurants restaurant on restaurant.id = subscription.restaurant_id
    where subscription.status = 'trial'
      and subscription.trial_ends_at is not null
      and subscription.trial_ends_at <= p_occurred_at + interval '7 days'
      and restaurant.deleted_at is null
      and (
        subscription.trial_ends_at <= p_occurred_at
        or not exists (
          select 1 from public.domain_outbox event
          where event.idempotency_key =
            'billing:trial-reminder:v1:' || subscription.id || ':' ||
            case
              when subscription.trial_ends_at <= p_occurred_at + interval '1 day' then '1'
              when subscription.trial_ends_at <= p_occurred_at + interval '3 days' then '3'
              else '7'
            end || ':' || extract(epoch from subscription.trial_ends_at)::bigint
        )
      )
    order by subscription.trial_ends_at, subscription.id
    for update of subscription skip locked
    limit p_limit
  loop
    if v_trial.trial_ends_at <= p_occurred_at then
      update public.billing_subscriptions
      set status = 'trial_expired', version = version + 1, updated_at = p_occurred_at
      where id = v_trial.id and status = 'trial';
      if found then
        update public.restaurants set plan = 'free'
        where id = v_trial.restaurant_id;
        insert into public.tenant_lifecycle_events (
          restaurant_id, subscription_id, from_status, to_status, actor_type,
          actor_user_id, reason_code, request_id, occurred_at
        ) values (
          v_trial.restaurant_id, v_trial.id, 'trial', 'trial_expired', 'system',
          null, 'trial_ended_without_payment', 'trial:expired:' || v_trial.id, p_occurred_at
        ) on conflict (request_id) do nothing;
        v_expired_trials := v_expired_trials + 1;
      end if;
      continue;
    end if;

    if v_trial.trial_ends_at <= p_occurred_at + interval '1 day' then
      v_event_type := 'subscription.trial_expiring_1';
    elsif v_trial.trial_ends_at <= p_occurred_at + interval '3 days' then
      v_event_type := 'subscription.trial_expiring_3';
    else
      v_event_type := 'subscription.trial_expiring_7';
    end if;
    v_key := 'billing:trial-reminder:v1:' || v_trial.id || ':'
      || right(v_event_type, 1) || ':' || extract(epoch from v_trial.trial_ends_at)::bigint;
    v_event_id := null;
    insert into public.domain_outbox (
      restaurant_id, aggregate_type, aggregate_id, event_type,
      payload, idempotency_key, occurred_at, available_at
    ) values (
      v_trial.restaurant_id, 'billing_subscription', v_trial.id, v_event_type,
      jsonb_build_object(
        'trialEndsAt', v_trial.trial_ends_at,
        'daysRemaining', right(v_event_type, 1)::integer,
        'semanticVersion', 1
      ),
      v_key, p_occurred_at, p_occurred_at
    ) on conflict (idempotency_key) do nothing returning id into v_event_id;
    if v_event_id is not null then v_trial_reminders := v_trial_reminders + 1; end if;
  end loop;

  for v_onboarding in
    select state.restaurant_id, state.started_at,
      case when state.started_at <= p_occurred_at - interval '72 hours' then 72 else 24 end as reminder_hour
    from public.restaurant_onboarding_states state
    join public.restaurants restaurant on restaurant.id = state.restaurant_id
    where state.status <> 'completed'
      and state.checklist_dismissed_at is null
      and state.started_at <= p_occurred_at - interval '24 hours'
      and restaurant.deleted_at is null
      and not exists (
        select 1 from public.domain_outbox event
        where event.idempotency_key = 'onboarding:incomplete:v1:' || state.restaurant_id || ':'
          || case when state.started_at <= p_occurred_at - interval '72 hours' then '72' else '24' end
      )
    order by state.started_at, state.restaurant_id
    for update of state skip locked
    limit p_limit
  loop
    v_event_id := null;
    insert into public.domain_outbox (
      restaurant_id, aggregate_type, aggregate_id, event_type,
      payload, idempotency_key, occurred_at, available_at
    ) values (
      v_onboarding.restaurant_id, 'onboarding', v_onboarding.restaurant_id,
      'onboarding.incomplete',
      jsonb_build_object(
        'reminderHour', v_onboarding.reminder_hour,
        'semanticVersion', 1
      ),
      'onboarding:incomplete:v1:' || v_onboarding.restaurant_id || ':' || v_onboarding.reminder_hour,
      p_occurred_at, p_occurred_at
    ) on conflict (idempotency_key) do nothing returning id into v_event_id;
    if v_event_id is not null then v_onboarding_reminders := v_onboarding_reminders + 1; end if;
  end loop;

  return jsonb_build_object(
    'trialReminders', v_trial_reminders,
    'onboardingReminders', v_onboarding_reminders,
    'expiredTrials', v_expired_trials
  );
end;
$$;

create or replace function public.complete_accounting_invoice_job(
  p_job_id uuid,
  p_worker_id text,
  p_provider_contact_ref text,
  p_provider_invoice_ref text,
  p_fiscal_document_type text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job public.accounting_invoice_jobs%rowtype;
begin
  if p_fiscal_document_type not in ('e_fatura', 'e_arsiv') then
    raise exception 'accounting_document_type_invalid' using errcode = '22023';
  end if;
  update public.accounting_invoice_jobs set
    status = 'succeeded', provider_contact_ref = btrim(p_provider_contact_ref),
    provider_invoice_ref = btrim(p_provider_invoice_ref), fiscal_document_type = p_fiscal_document_type,
    completed_at = clock_timestamp(), locked_at = null, locked_by = null,
    last_error_code = null, updated_at = clock_timestamp()
  where id = p_job_id and status = 'processing' and locked_by = btrim(p_worker_id)
  returning * into v_job;
  if not found then return false; end if;

  perform public.enqueue_domain_outbox_event(
    v_job.restaurant_id, 'billing_invoice', v_job.subscription_invoice_id,
    'fiscal_document.ready',
    jsonb_build_object(
      'accountingJobId', v_job.id,
      'invoiceId', v_job.subscription_invoice_id,
      'fiscalDocumentType', v_job.fiscal_document_type,
      'semanticVersion', 1
    ),
    'billing:fiscal-document-ready:v1:' || v_job.subscription_invoice_id
  );
  return true;
end;
$$;

create function public.record_accounting_invoice_email_delivery(
  p_job_id uuid,
  p_provider_message_id text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job public.accounting_invoice_jobs%rowtype;
  v_owner_id uuid;
  v_email text;
begin
  if p_job_id is null
    or coalesce(char_length(btrim(p_provider_message_id)), 0) not between 1 and 200 then
    raise exception 'accounting_email_delivery_input_invalid' using errcode = '22023';
  end if;
  select job.*
  into v_job
  from public.accounting_invoice_jobs job
  join public.restaurants restaurant on restaurant.id = job.restaurant_id
  where job.id = p_job_id and job.status = 'processing'
  for update of job;
  if not found then return false; end if;
  select restaurant.owner_id into v_owner_id
  from public.restaurants restaurant
  where restaurant.id = v_job.restaurant_id;
  v_email := nullif(btrim(v_job.billing_profile_snapshot ->> 'email'), '');
  if v_email is null then
    raise exception 'accounting_email_recipient_missing' using errcode = '55000';
  end if;

  insert into public.notification_deliveries (
    outbox_id, restaurant_id, recipient_user_id, channel, category,
    dedupe_key, recipient_address, subject, status, attempts,
    provider_message_id, provider_delivery_status, provider_event_at,
    last_error, sent_at, updated_at
  ) values (
    null, v_job.restaurant_id, v_owner_id, 'email', 'billing',
    'fiscal_document.ready:' || v_job.subscription_invoice_id,
    v_email, 'Masabu abonelik faturanız', 'sent', greatest(v_job.attempts, 1),
    btrim(p_provider_message_id), 'sent', clock_timestamp(),
    null, clock_timestamp(), clock_timestamp()
  ) on conflict (recipient_user_id, dedupe_key, channel) do update set
    recipient_address = excluded.recipient_address,
    status = 'sent',
    attempts = greatest(public.notification_deliveries.attempts, excluded.attempts),
    provider_message_id = excluded.provider_message_id,
    provider_delivery_status = coalesce(public.notification_deliveries.provider_delivery_status, 'sent'),
    provider_event_at = coalesce(public.notification_deliveries.provider_event_at, excluded.provider_event_at),
    last_error = null,
    sent_at = coalesce(public.notification_deliveries.sent_at, excluded.sent_at),
    updated_at = clock_timestamp()
  where public.notification_deliveries.restaurant_id = excluded.restaurant_id;
  return true;
end;
$$;

create function public.record_resend_notification_event(
  p_webhook_id text,
  p_provider_message_id text,
  p_event_type text,
  p_occurred_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_delivery public.notification_deliveries%rowtype;
begin
  if nullif(btrim(p_webhook_id), '') is null or char_length(p_webhook_id) > 200
    or nullif(btrim(p_provider_message_id), '') is null or char_length(p_provider_message_id) > 200
    or p_event_type not in (
      'sent', 'delivered', 'delivery_delayed', 'opened', 'clicked',
      'bounced', 'complained', 'suppressed', 'failed'
    ) or p_occurred_at is null then
    raise exception 'invalid Resend notification event' using errcode = '22023';
  end if;
  select * into v_delivery
  from public.notification_deliveries delivery
  where delivery.provider_message_id = btrim(p_provider_message_id)
    and delivery.channel = 'email'
  limit 1;
  if v_delivery.id is null then return false; end if;

  insert into public.notification_delivery_provider_events (
    webhook_id, notification_delivery_id, provider_message_id, event_type, occurred_at
  ) values (
    btrim(p_webhook_id), v_delivery.id, btrim(p_provider_message_id), p_event_type, p_occurred_at
  ) on conflict (webhook_id) do nothing;
  if not found then return true; end if;

  update public.notification_deliveries delivery set
    provider_delivery_status = case
      when delivery.provider_event_at is null or p_occurred_at >= delivery.provider_event_at
        then p_event_type
      else delivery.provider_delivery_status
    end,
    provider_event_at = greatest(coalesce(delivery.provider_event_at, p_occurred_at), p_occurred_at),
    last_error = case
      when p_event_type in ('bounced', 'complained', 'suppressed', 'failed')
        then 'provider_' || p_event_type
      else delivery.last_error
    end,
    updated_at = clock_timestamp()
  where delivery.id = v_delivery.id;
  return true;
end;
$$;

create or replace function public.get_notification_delivery_health()
returns table (
  consumer text,
  pending_count bigint,
  failed_count bigint,
  dead_letter_count bigint,
  last_success_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with consumers(consumer) as (
    values ('dashboard-inbox'::text), ('dashboard-push'::text), ('notification-email'::text)
  ), relevant as (
    select event.id, event.processed_at, event.dead_lettered_at, event.last_error
    from public.domain_outbox event
    where event.event_type in (
      'order.created', 'service_request.created', 'onboarding.incomplete',
      'subscription.trial_started', 'subscription.trial_expiring_7',
      'subscription.trial_expiring_3', 'subscription.trial_expiring_1',
      'subscription.trial_expired', 'invoice.upcoming',
      'subscription.cancellation_scheduled', 'subscription.cancellation_withdrawn',
      'subscription.cancelled', 'invoice.payment_failed', 'billing.retry_requested',
      'billing.warning_3', 'billing.warning_7', 'billing.reconciliation_required',
      'invoice.paid', 'plan.change_scheduled', 'plan.changed', 'payment_method.updated',
      'refund.requested', 'refund.succeeded', 'refund.failed',
      'fiscal_document.ready', 'tenant.suspended', 'tenant.reactivated'
    )
  )
  select
    channel.consumer,
    count(event.id) filter (
      where event.processed_at is null and event.dead_lettered_at is null
        and receipt.outbox_id is null
    ),
    count(event.id) filter (where event.last_error is not null and receipt.outbox_id is null)
      + case when channel.consumer = 'notification-email' then (
          select count(*) from public.notification_deliveries delivery
          where delivery.channel = 'email'
            and (delivery.status = 'failed'
              or delivery.provider_delivery_status in ('bounced', 'complained', 'suppressed', 'failed'))
        ) else 0 end,
    count(event.id) filter (where event.dead_lettered_at is not null and receipt.outbox_id is null)
      + case when channel.consumer = 'notification-email' then (
          select count(*) from public.notification_deliveries delivery
          where delivery.channel = 'email' and delivery.status = 'dead'
        ) else 0 end,
    max(receipt.processed_at)
  from consumers channel
  left join relevant event on true
  left join public.domain_outbox_receipts receipt
    on receipt.outbox_id = event.id and receipt.consumer = channel.consumer
  group by channel.consumer
  order by channel.consumer;
$$;

revoke all on function public.enqueue_subscription_lifecycle_notifications(integer,timestamptz)
  from public, anon, authenticated;
revoke all on function public.record_accounting_invoice_email_delivery(uuid,text)
  from public, anon, authenticated;
revoke all on function public.record_resend_notification_event(text,text,text,timestamptz)
  from public, anon, authenticated;
grant execute on function public.enqueue_subscription_lifecycle_notifications(integer,timestamptz)
  to service_role;
grant execute on function public.record_accounting_invoice_email_delivery(uuid,text)
  to service_role;
grant execute on function public.record_resend_notification_event(text,text,text,timestamptz)
  to service_role;

comment on function public.enqueue_subscription_lifecycle_notifications(integer,timestamptz) is
  'Idempotently emits D-7/D-3/D-1 trial and consent-gated 24h/72h onboarding occurrences and expires due trials without touching provider payment state.';
comment on function public.record_resend_notification_event(text,text,text,timestamptz) is
  'Projects signed Resend delivery outcomes onto transactional notification delivery health without storing webhook payloads.';

commit;
