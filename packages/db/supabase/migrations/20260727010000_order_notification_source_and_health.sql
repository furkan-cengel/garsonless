-- Distinguish customer-created orders from staff-entered orders so operational
-- alerts never notify the employee about their own manual entry.

alter table public.orders
  add column if not exists source text not null default 'customer'
  check (source in ('customer', 'staff'));

create or replace function public.outbox_orders_after_insert()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  perform public.enqueue_domain_outbox_event(
    new.restaurant_id,
    'order',
    new.id,
    'order.created',
    jsonb_build_object(
      'status', new.status,
      'source', new.source,
      'tableId', new.table_id,
      'tableSessionId', new.table_session_id,
      'total', new.total
    ),
    'order.created:' || new.id::text
  );
  return new;
end;
$$;

-- Channel-level delivery health without exposing endpoints, identities or
-- notification content. Used by the worker health probe and operations UI.
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
    select o.id, o.processed_at, o.dead_lettered_at, o.last_error
    from public.domain_outbox o
    where o.event_type in ('order.created', 'service_request.created')
  )
  select
    c.consumer,
    count(r.id) filter (
      where r.processed_at is null and r.dead_lettered_at is null
        and receipt.outbox_id is null
    ),
    count(r.id) filter (where r.last_error is not null and receipt.outbox_id is null),
    count(r.id) filter (where r.dead_lettered_at is not null and receipt.outbox_id is null),
    max(receipt.processed_at)
  from consumers c
  left join relevant r on true
  left join public.domain_outbox_receipts receipt
    on receipt.outbox_id = r.id and receipt.consumer = c.consumer
  group by c.consumer
  order by c.consumer;
$$;

revoke all on function public.get_notification_delivery_health() from public, anon, authenticated;
grant execute on function public.get_notification_delivery_health() to service_role;
