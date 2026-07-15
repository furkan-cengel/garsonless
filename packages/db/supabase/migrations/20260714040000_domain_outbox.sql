-- Modular-monolith foundation: durable domain events are written in the same
-- transaction as their aggregate mutation. This table is intentionally not
-- exposed to browser roles; only the service-role worker can claim events.

create table if not exists public.domain_outbox (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  aggregate_type text not null check (aggregate_type in ('order', 'table_session', 'service_request')),
  aggregate_id uuid not null,
  event_type text not null check (event_type in (
    'order.created',
    'order.status_changed',
    'order.settled',
    'table_session.closed',
    'service_request.created'
  )),
  payload jsonb not null default '{}'::jsonb,
  idempotency_key text not null unique,
  occurred_at timestamptz not null default now(),
  available_at timestamptz not null default now(),
  attempts integer not null default 0 check (attempts >= 0),
  locked_at timestamptz,
  locked_by text,
  processed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

create index if not exists domain_outbox_ready_idx
  on public.domain_outbox(available_at, occurred_at)
  where processed_at is null;

create index if not exists domain_outbox_restaurant_idx
  on public.domain_outbox(restaurant_id, occurred_at desc);

-- A receipt is the consumer's idempotency boundary. The initial worker writes
-- an operational projection receipt; future consumers get their own name and
-- cannot duplicate a side effect for an already-delivered event.
create table if not exists public.domain_outbox_receipts (
  outbox_id uuid not null references public.domain_outbox(id) on delete cascade,
  consumer text not null,
  processed_at timestamptz not null default now(),
  primary key (outbox_id, consumer)
);

alter table public.domain_outbox enable row level security;
alter table public.domain_outbox_receipts enable row level security;
revoke all on public.domain_outbox from public, anon, authenticated;
revoke all on public.domain_outbox_receipts from public, anon, authenticated;

create or replace function public.enqueue_domain_outbox_event(
  p_restaurant_id uuid,
  p_aggregate_type text,
  p_aggregate_id uuid,
  p_event_type text,
  p_payload jsonb,
  p_idempotency_key text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.domain_outbox (
    restaurant_id, aggregate_type, aggregate_id, event_type, payload, idempotency_key
  ) values (
    p_restaurant_id, p_aggregate_type, p_aggregate_id, p_event_type, coalesce(p_payload, '{}'::jsonb), p_idempotency_key
  )
  on conflict (idempotency_key) do nothing;
end;
$$;

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
      'tableId', new.table_id,
      'tableSessionId', new.table_session_id,
      'total', new.total
    ),
    'order.created:' || new.id::text
  );
  return new;
end;
$$;

create or replace function public.outbox_orders_after_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.status is distinct from new.status then
    perform public.enqueue_domain_outbox_event(
      new.restaurant_id,
      'order',
      new.id,
      'order.status_changed',
      jsonb_build_object('from', old.status, 'to', new.status),
      'order.status_changed:' || new.id::text || ':' || coalesce(new.updated_at::text, clock_timestamp()::text)
    );
  end if;

  if old.paid_at is null and new.paid_at is not null then
    perform public.enqueue_domain_outbox_event(
      new.restaurant_id,
      'order',
      new.id,
      'order.settled',
      jsonb_build_object('paymentMethod', new.payment_method, 'paidAt', new.paid_at, 'total', new.total),
      'order.settled:' || new.id::text || ':' || new.paid_at::text
    );
  end if;
  return new;
end;
$$;

create or replace function public.outbox_table_sessions_after_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.closed_at is null and new.closed_at is not null then
    perform public.enqueue_domain_outbox_event(
      new.restaurant_id,
      'table_session',
      new.id,
      'table_session.closed',
      jsonb_build_object('tableId', new.table_id, 'closedAt', new.closed_at, 'closeReason', new.close_reason),
      'table_session.closed:' || new.id::text || ':' || new.closed_at::text
    );
  end if;
  return new;
end;
$$;

create or replace function public.outbox_service_requests_after_insert()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  perform public.enqueue_domain_outbox_event(
    new.restaurant_id,
    'service_request',
    new.id,
    'service_request.created',
    jsonb_build_object('tableId', new.table_id, 'tableSessionId', new.table_session_id, 'requestType', new.request_type),
    'service_request.created:' || new.id::text
  );
  return new;
end;
$$;

drop trigger if exists domain_outbox_orders_insert on public.orders;
create trigger domain_outbox_orders_insert
  after insert on public.orders
  for each row execute function public.outbox_orders_after_insert();

drop trigger if exists domain_outbox_orders_update on public.orders;
create trigger domain_outbox_orders_update
  after update on public.orders
  for each row execute function public.outbox_orders_after_update();

drop trigger if exists domain_outbox_table_sessions_update on public.table_sessions;
create trigger domain_outbox_table_sessions_update
  after update on public.table_sessions
  for each row execute function public.outbox_table_sessions_after_update();

drop trigger if exists domain_outbox_service_requests_insert on public.service_requests;
create trigger domain_outbox_service_requests_insert
  after insert on public.service_requests
  for each row execute function public.outbox_service_requests_after_insert();

-- Claiming uses SKIP LOCKED so horizontally concurrent invocations never work
-- the same event. A lease makes a crashed worker's events retryable.
create or replace function public.claim_domain_outbox(
  p_worker text,
  p_limit integer default 25,
  p_lease_seconds integer default 60
)
returns setof public.domain_outbox
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(nullif(btrim(p_worker), ''), '') = '' then
    raise exception 'worker is required' using errcode = '22023';
  end if;

  return query
  with candidate as (
    select id
    from public.domain_outbox
    where processed_at is null
      and available_at <= now()
      and (locked_at is null or locked_at < now() - make_interval(secs => greatest(p_lease_seconds, 1)))
    order by occurred_at, id
    limit greatest(least(p_limit, 100), 1)
    for update skip locked
  )
  update public.domain_outbox event
  set locked_at = now(),
      locked_by = p_worker,
      attempts = event.attempts + 1
  from candidate
  where event.id = candidate.id
  returning event.*;
end;
$$;

create or replace function public.ack_domain_outbox(
  p_event_id uuid,
  p_worker text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.domain_outbox
  set processed_at = now(), locked_at = null, locked_by = null, last_error = null
  where id = p_event_id
    and processed_at is null
    and locked_by = p_worker;
  return found;
end;
$$;

create or replace function public.fail_domain_outbox(
  p_event_id uuid,
  p_worker text,
  p_error text,
  p_delay_seconds integer default 30
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.domain_outbox
  set locked_at = null,
      locked_by = null,
      available_at = now() + make_interval(secs => greatest(1, least(p_delay_seconds, 86400))),
      last_error = left(coalesce(p_error, 'unknown error'), 1000)
  where id = p_event_id
    and processed_at is null
    and locked_by = p_worker;
  return found;
end;
$$;

revoke all on function public.enqueue_domain_outbox_event(uuid, text, uuid, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.claim_domain_outbox(text, integer, integer) from public, anon, authenticated;
revoke all on function public.ack_domain_outbox(uuid, text) from public, anon, authenticated;
revoke all on function public.fail_domain_outbox(uuid, text, text, integer) from public, anon, authenticated;
grant execute on function public.claim_domain_outbox(text, integer, integer) to service_role;
grant execute on function public.ack_domain_outbox(uuid, text) to service_role;
grant execute on function public.fail_domain_outbox(uuid, text, text, integer) to service_role;
