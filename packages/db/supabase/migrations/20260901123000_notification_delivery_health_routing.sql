-- Keep delivery health aligned with the worker's actual fan-out routes.
-- Lifecycle and billing events are durable inbox/e-mail work, but they are
-- intentionally not web-push work. Counting them for dashboard-push would
-- create permanent false-positive pending/dead-letter metrics.

begin;

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
    select
      event.id,
      event.event_type,
      event.processed_at,
      event.dead_lettered_at,
      event.last_error
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
  ), routed as (
    select event.*, channel.consumer
    from relevant event
    cross join (
      values ('dashboard-inbox'::text), ('notification-email'::text)
    ) channel(consumer)

    union all

    select event.*, 'dashboard-push'::text as consumer
    from relevant event
    where event.event_type in ('order.created', 'service_request.created')
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
  left join routed event on event.consumer = channel.consumer
  left join public.domain_outbox_receipts receipt
    on receipt.outbox_id = event.id and receipt.consumer = channel.consumer
  group by channel.consumer
  order by channel.consumer;
$$;

revoke all on function public.get_notification_delivery_health()
  from public, anon, authenticated;
grant execute on function public.get_notification_delivery_health()
  to service_role;

comment on function public.get_notification_delivery_health() is
  'Reports durable notification health only for events routed to each consumer; provider failures are folded into notification-email.';

commit;
