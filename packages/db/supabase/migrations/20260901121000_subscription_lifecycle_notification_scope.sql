-- Keep production maintenance global while allowing isolated, service-only
-- verification and support replay for one explicit tenant.

begin;

drop function public.enqueue_subscription_lifecycle_notifications(integer,timestamptz);

create function public.enqueue_subscription_lifecycle_notifications(
  p_limit integer default 100,
  p_occurred_at timestamptz default clock_timestamp(),
  p_restaurant_id uuid default null
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
      and (p_restaurant_id is null or subscription.restaurant_id = p_restaurant_id)
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
        update public.restaurants set plan = 'free' where id = v_trial.restaurant_id;
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
      and (p_restaurant_id is null or state.restaurant_id = p_restaurant_id)
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
      jsonb_build_object('reminderHour', v_onboarding.reminder_hour, 'semanticVersion', 1),
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

revoke all on function public.enqueue_subscription_lifecycle_notifications(integer,timestamptz,uuid)
  from public, anon, authenticated;
grant execute on function public.enqueue_subscription_lifecycle_notifications(integer,timestamptz,uuid)
  to service_role;

comment on function public.enqueue_subscription_lifecycle_notifications(integer,timestamptz,uuid) is
  'Idempotently emits subscription lifecycle occurrences globally for maintenance or for one explicit tenant during isolated service-role verification.';

commit;
