-- Slice 6: customer loyalty refund reconciliation, append-only consent audit,
-- aggregate/cursor loyalty reads and global privacy request workflow.
-- All new customer-owned tables and RPCs are service-role only.

-- ---------------------------------------------------------------------------
-- Loyalty reversals linked to the successful monetary refund that caused them
-- ---------------------------------------------------------------------------

alter table public.loyalty_transactions
  drop constraint if exists loyalty_transactions_direction_check;

alter table public.loyalty_transactions
  add constraint loyalty_transactions_direction_check
  check (direction in ('earn', 'redeem', 'refund', 'reversal'));

alter table public.loyalty_transactions
  add column if not exists refund_id uuid references public.order_refunds(id) on delete restrict;

drop index if exists public.loyalty_tx_order_type_dir_uniq;
create unique index loyalty_tx_order_type_dir_uniq
  on public.loyalty_transactions(order_id, type, direction)
  where order_id is not null and refund_id is null;

create unique index if not exists loyalty_tx_refund_type_dir_uniq
  on public.loyalty_transactions(refund_id, type, direction)
  where refund_id is not null;

create index if not exists loyalty_tx_customer_scope_activity_idx
  on public.loyalty_transactions(customer_id, scope_key, created_at desc, id desc);

create or replace function public.apply_order_loyalty_adjustment(
  p_order_id uuid,
  p_refund_id uuid default null,
  p_force_full boolean default false
)
returns table (
  loyalty_type text,
  adjustment_direction text,
  adjustment_delta integer,
  linked_refund_id uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_refund public.order_refunds%rowtype;
  v_refunded_total numeric(12,2) := 0;
  v_ratio numeric := 0;
  v_full boolean := false;
  v_type text;
  v_earned integer;
  v_reversed integer;
  v_target integer;
  v_needed integer;
  v_redeemed integer;
  v_restored integer;
begin
  select * into v_order
    from public.orders o
   where o.id = p_order_id and o.deleted_at is null
   for update;
  if not found or v_order.customer_id is null then return; end if;

  if p_refund_id is not null then
    select * into v_refund
      from public.order_refunds r
     where r.id = p_refund_id and r.order_id = p_order_id
       and r.restaurant_id = v_order.restaurant_id and r.status = 'succeeded';
    if not found then
      raise exception 'Successful refund not found for loyalty adjustment' using errcode = 'P0001';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtext(v_order.customer_id::text || ':' || p_order_id::text));

  select coalesce(sum(r.amount), 0) into v_refunded_total
    from public.order_refunds r
   where r.order_id = p_order_id
     and r.restaurant_id = v_order.restaurant_id
     and r.status = 'succeeded';

  v_full := p_force_full
    or v_order.status = 'cancelled'
    or v_order.total <= 0
    or v_refunded_total >= round(v_order.total::numeric, 2);
  v_ratio := case
    when v_full then 1
    when v_order.total > 0 then least(1, greatest(0, v_refunded_total / v_order.total::numeric))
    else 0
  end;

  foreach v_type in array array['points'::text, 'stamp'::text] loop
    select coalesce(sum(t.delta), 0)::integer into v_earned
      from public.loyalty_transactions t
     where t.order_id = p_order_id and t.type = v_type
       and t.direction = 'earn' and t.delta > 0;

    select greatest(0, -coalesce(sum(t.delta), 0))::integer into v_reversed
      from public.loyalty_transactions t
     where t.order_id = p_order_id and t.type = v_type
       and t.direction = 'reversal' and t.delta < 0;

    v_target := case
      when v_type = 'points' then floor(v_earned * v_ratio)::integer
      when v_full then v_earned
      else 0
    end;
    v_needed := greatest(0, v_target - v_reversed);

    if v_needed > 0 then
      insert into public.loyalty_transactions(
        customer_id, restaurant_id, scope_key, order_id, refund_id,
        type, delta, reason, direction
      )
      select
        v_order.customer_id,
        v_order.restaurant_id,
        source.scope_key,
        p_order_id,
        p_refund_id,
        v_type,
        -v_needed,
        case when v_full then 'refund_full_earn_reversal' else 'refund_partial_points_reversal' end,
        'reversal'
      from public.loyalty_transactions source
      where source.order_id = p_order_id and source.type = v_type and source.direction = 'earn'
      order by source.created_at, source.id
      limit 1;

      if found then
        loyalty_type := v_type;
        adjustment_direction := 'reversal';
        adjustment_delta := -v_needed;
        linked_refund_id := p_refund_id;
        return next;
      end if;
    end if;

    if v_full then
      select greatest(0, -coalesce(sum(t.delta), 0))::integer into v_redeemed
        from public.loyalty_transactions t
       where t.order_id = p_order_id and t.type = v_type
         and t.direction = 'redeem' and t.delta < 0;
      select greatest(0, coalesce(sum(t.delta), 0))::integer into v_restored
        from public.loyalty_transactions t
       where t.order_id = p_order_id and t.type = v_type
         and t.direction = 'refund' and t.delta > 0;
      v_needed := greatest(0, v_redeemed - v_restored);

      if v_needed > 0 then
        insert into public.loyalty_transactions(
          customer_id, restaurant_id, scope_key, order_id, refund_id,
          type, delta, reason, direction
        )
        select
          v_order.customer_id,
          v_order.restaurant_id,
          source.scope_key,
          p_order_id,
          p_refund_id,
          v_type,
          v_needed,
          'refund_full_redeem_restore',
          'refund'
        from public.loyalty_transactions source
        where source.order_id = p_order_id and source.type = v_type and source.direction = 'redeem'
        order by source.created_at, source.id
        limit 1;

        if found then
          loyalty_type := v_type;
          adjustment_direction := 'refund';
          adjustment_delta := v_needed;
          linked_refund_id := p_refund_id;
          return next;
        end if;
      end if;
    end if;
  end loop;
end;
$$;

create or replace function public.reconcile_order_loyalty_after_earn(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_refund_id uuid;
  v_cancelled boolean;
begin
  select (o.status = 'cancelled') into v_cancelled
    from public.orders o where o.id = p_order_id;
  select r.id into v_refund_id
    from public.order_refunds r
   where r.order_id = p_order_id and r.status = 'succeeded'
   order by r.refunded_at desc nulls last, r.id desc
   limit 1;
  perform public.apply_order_loyalty_adjustment(p_order_id, v_refund_id, coalesce(v_cancelled, false));
end;
$$;

create or replace function public.loyalty_earn_reconcile_trigger()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.order_id is not null and new.direction = 'earn' then
    perform public.reconcile_order_loyalty_after_earn(new.order_id);
  end if;
  return new;
end;
$$;

drop trigger if exists loyalty_earn_reconcile_after_insert on public.loyalty_transactions;
create trigger loyalty_earn_reconcile_after_insert
  after insert on public.loyalty_transactions
  for each row
  when (new.order_id is not null and new.direction = 'earn')
  execute function public.loyalty_earn_reconcile_trigger();

create or replace function public.order_refund_loyalty_reconcile_trigger()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status = 'succeeded' and tg_op = 'INSERT' then
    perform public.apply_order_loyalty_adjustment(new.order_id, new.id, false);
  elsif new.status = 'succeeded' and old.status is distinct from 'succeeded' then
    perform public.apply_order_loyalty_adjustment(new.order_id, new.id, false);
  end if;
  return new;
end;
$$;

drop trigger if exists order_refund_loyalty_reconcile on public.order_refunds;
create trigger order_refund_loyalty_reconcile
  after insert or update of status on public.order_refunds
  for each row execute function public.order_refund_loyalty_reconcile_trigger();

create or replace function public.refund_cancelled_loyalty(p_order uuid)
returns table(type text, refunded integer)
language sql
security definer
set search_path = public, pg_temp
as $$
  select result.loyalty_type, result.adjustment_delta
  from public.apply_order_loyalty_adjustment(p_order, null, true) result
  where result.adjustment_direction = 'refund' and result.adjustment_delta > 0;
$$;

-- Idempotent forward-fix for already successful refunds and cancelled orders.
do $backfill$
declare row record;
begin
  for row in
    select r.id, r.order_id
      from public.order_refunds r
     where r.status = 'succeeded'
     order by r.refunded_at nulls last, r.id
  loop
    perform public.apply_order_loyalty_adjustment(row.order_id, row.id, false);
  end loop;
  for row in
    select o.id
      from public.orders o
     where o.status = 'cancelled' and o.customer_id is not null and o.deleted_at is null
  loop
    perform public.apply_order_loyalty_adjustment(row.id, null, true);
  end loop;
end;
$backfill$;

revoke all on function public.apply_order_loyalty_adjustment(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.reconcile_order_loyalty_after_earn(uuid) from public, anon, authenticated;
revoke all on function public.refund_cancelled_loyalty(uuid) from public, anon, authenticated;
grant execute on function public.apply_order_loyalty_adjustment(uuid, uuid, boolean) to service_role;
grant execute on function public.reconcile_order_loyalty_after_earn(uuid) to service_role;
grant execute on function public.refund_cancelled_loyalty(uuid) to service_role;

-- Lifetime points are earned points plus negative earning reversals.
do $lifetime_fix$
declare
  fn regprocedure := 'public.get_restaurant_customers(uuid,uuid,text,text,text,integer,integer,jsonb)'::regprocedure;
  definition text;
begin
  select pg_get_functiondef(fn) into definition;
  if position('direction in (''earn'',''reversal'')' in definition) = 0 then
    if position('direction = ''earn''' in definition) = 0 then
      raise exception 'get_restaurant_customers lifetime predicate has unexpected shape';
    end if;
    execute replace(definition, 'direction = ''earn''', 'direction in (''earn'',''reversal'')');
  end if;
end;
$lifetime_fix$;

do $timeline_fix$
declare
  fn regprocedure := 'public.get_restaurant_customer_timeline(uuid,uuid,timestamptz,text,uuid,integer)'::regprocedure;
  definition text;
begin
  select pg_get_functiondef(fn) into definition;
  if position('''reversal''' in definition) = 0 then
    if position('direction in (''earn'', ''redeem'', ''refund'')' in definition) = 0 then
      raise exception 'customer timeline direction predicate has unexpected shape';
    end if;
    execute replace(
      definition,
      'direction in (''earn'', ''redeem'', ''refund'')',
      'direction in (''earn'', ''redeem'', ''refund'', ''reversal'')'
    );
  end if;
end;
$timeline_fix$;

create or replace function public.get_customer_loyalty_aggregates(p_customer_id uuid)
returns table(
  restaurant_id uuid,
  scope_key uuid,
  points integer,
  stamps integer,
  lifetime_points integer,
  visits integer,
  latest_activity_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select
    ledger.restaurant_id,
    ledger.scope_key,
    coalesce(sum(ledger.delta) filter (where ledger.type = 'points'), 0)::integer,
    coalesce(sum(ledger.delta) filter (where ledger.type = 'stamp'), 0)::integer,
    coalesce(sum(ledger.delta) filter (
      where ledger.type = 'points' and ledger.direction in ('earn', 'reversal')
    ), 0)::integer,
    coalesce(sum(ledger.delta) filter (where ledger.type = 'visit'), 0)::integer,
    max(ledger.created_at)
  from public.loyalty_transactions ledger
  where ledger.customer_id = p_customer_id
  group by ledger.restaurant_id, ledger.scope_key;
$$;

create or replace function public.get_customer_loyalty_activity_page(
  p_customer_id uuid,
  p_restaurant_id uuid,
  p_scope_key uuid,
  p_before_at timestamptz default null,
  p_before_id uuid default null,
  p_limit integer default 8
)
returns table(
  event_id uuid,
  loyalty_type text,
  direction text,
  delta integer,
  reason text,
  event_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select ledger.id, ledger.type, ledger.direction, ledger.delta, ledger.reason, ledger.created_at
  from public.loyalty_transactions ledger
  where ledger.customer_id = p_customer_id
    and ledger.restaurant_id = p_restaurant_id
    and ledger.scope_key = p_scope_key
    and ledger.type in ('points', 'stamp', 'visit')
    and ledger.direction in ('earn', 'redeem', 'refund', 'reversal')
    and (
      (p_before_at is null and p_before_id is null)
      or (
        p_before_at is not null and p_before_id is not null
        and (ledger.created_at < p_before_at or (ledger.created_at = p_before_at and ledger.id < p_before_id))
      )
    )
  order by ledger.created_at desc, ledger.id desc
  limit least(greatest(p_limit, 1), 50) + 1;
$$;

revoke all on function public.get_customer_loyalty_aggregates(uuid) from public, anon, authenticated;
revoke all on function public.get_customer_loyalty_activity_page(uuid, uuid, uuid, timestamptz, uuid, integer) from public, anon, authenticated;
grant execute on function public.get_customer_loyalty_aggregates(uuid) to service_role;
grant execute on function public.get_customer_loyalty_activity_page(uuid, uuid, uuid, timestamptz, uuid, integer) to service_role;

-- ---------------------------------------------------------------------------
-- Append-only consent events (the current customer_consents row stays a cache)
-- ---------------------------------------------------------------------------

create table if not exists public.customer_consent_events (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  consent_type text not null check (consent_type in ('contact_data', 'marketing')),
  action text not null check (action in ('granted', 'revoked')),
  policy_version text not null check (length(policy_version) between 1 and 80),
  text_digest text not null check (text_digest ~ '^[a-f0-9]{64}$'),
  lawful_basis text not null check (lawful_basis in ('explicit_consent', 'contract', 'legal_obligation')),
  source text not null check (source in ('join', 'member_sheet', 'account_center', 'legacy_backfill')),
  occurred_at timestamptz not null default now()
);

create index if not exists customer_consent_events_customer_idx
  on public.customer_consent_events(customer_id, occurred_at desc, id desc);

alter table public.customer_consent_events enable row level security;
alter table public.customer_consent_events force row level security;
revoke all on table public.customer_consent_events from public, anon, authenticated;
grant select, insert on table public.customer_consent_events to service_role;

create or replace function public.reject_consent_event_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'Consent events are append-only' using errcode = '42501';
end;
$$;

drop trigger if exists customer_consent_events_append_only on public.customer_consent_events;
create trigger customer_consent_events_append_only
  before update or delete on public.customer_consent_events
  for each row execute function public.reject_consent_event_mutation();

create or replace function public.record_customer_consent_event(
  p_customer_id uuid,
  p_restaurant_id uuid,
  p_consent_type text,
  p_grant boolean,
  p_source text,
  p_policy_version text,
  p_text_digest text,
  p_lawful_basis text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_now timestamptz := clock_timestamp();
begin
  if p_consent_type not in ('contact_data', 'marketing')
     or p_source not in ('join', 'member_sheet', 'account_center')
     or p_lawful_basis not in ('explicit_consent', 'contract', 'legal_obligation')
     or length(coalesce(btrim(p_policy_version), '')) not between 1 and 80
     or coalesce(lower(btrim(p_text_digest)), '') !~ '^[a-f0-9]{64}$' then
    raise exception 'Consent event input is invalid' using errcode = '22023';
  end if;
  if not exists (select 1 from public.customers c where c.id = p_customer_id and c.merged_at is null)
     or not exists (select 1 from public.restaurants r where r.id = p_restaurant_id and r.deleted_at is null) then
    raise exception 'Consent subject or restaurant not found' using errcode = 'P0001';
  end if;

  insert into public.customer_consents(
    customer_id, restaurant_id, consent_type, granted_at, revoked_at, source, updated_at
  ) values (
    p_customer_id, p_restaurant_id, p_consent_type,
    case when p_grant then v_now else null end,
    case when p_grant then null else v_now end,
    p_source,
    v_now
  )
  on conflict (customer_id, restaurant_id, consent_type) do update set
    granted_at = excluded.granted_at,
    revoked_at = excluded.revoked_at,
    source = excluded.source,
    updated_at = excluded.updated_at;

  insert into public.customer_consent_events(
    customer_id, restaurant_id, consent_type, action,
    policy_version, text_digest, lawful_basis, source, occurred_at
  ) values (
    p_customer_id, p_restaurant_id, p_consent_type,
    case when p_grant then 'granted' else 'revoked' end,
    btrim(p_policy_version), lower(btrim(p_text_digest)), p_lawful_basis, p_source, v_now
  );

  insert into public.customer_restaurants(customer_id, restaurant_id, source)
  values (p_customer_id, p_restaurant_id, 'consent')
  on conflict (customer_id, restaurant_id) do nothing;
  return true;
end;
$$;

insert into public.customer_consent_events(
  customer_id, restaurant_id, consent_type, action,
  policy_version, text_digest, lawful_basis, source, occurred_at
)
select
  consent.customer_id,
  consent.restaurant_id,
  consent.consent_type,
  case when consent.granted_at is not null and consent.revoked_at is null then 'granted' else 'revoked' end,
  'legacy-v0',
  encode(extensions.digest('legacy-v0:' || consent.consent_type, 'sha256'), 'hex'),
  'explicit_consent',
  'legacy_backfill',
  coalesce(consent.revoked_at, consent.granted_at, consent.updated_at, consent.created_at)
from public.customer_consents consent
where consent.granted_at is not null or consent.revoked_at is not null;

revoke all on function public.record_customer_consent_event(uuid, uuid, text, boolean, text, text, text, text) from public, anon, authenticated;
grant execute on function public.record_customer_consent_event(uuid, uuid, text, boolean, text, text, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Global export / deletion requests. Delete is review-only, never hard-delete.
-- ---------------------------------------------------------------------------

create table if not exists public.customer_privacy_requests (
  id uuid primary key,
  customer_id uuid references public.customers(id) on delete set null,
  customer_reference_digest text not null check (customer_reference_digest ~ '^[a-f0-9]{64}$'),
  request_type text not null check (request_type in ('export', 'delete')),
  status text not null check (status in ('processing', 'completed', 'pending_review', 'approved', 'rejected', 'fulfilled')),
  idempotency_key text not null check (length(idempotency_key) between 1 and 200),
  payload_digest text check (payload_digest is null or payload_digest ~ '^[a-f0-9]{64}$'),
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  unique(customer_reference_digest, request_type, idempotency_key)
);

create index if not exists customer_privacy_requests_customer_idx
  on public.customer_privacy_requests(customer_id, requested_at desc);

alter table public.customer_privacy_requests enable row level security;
alter table public.customer_privacy_requests force row level security;
revoke all on table public.customer_privacy_requests from public, anon, authenticated;
grant select, insert, update on table public.customer_privacy_requests to service_role;

create or replace function public.create_customer_privacy_export(
  p_customer_id uuid,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_customer public.customers%rowtype;
  v_digest text := encode(extensions.digest(p_customer_id::text, 'sha256'), 'hex');
  v_existing public.customer_privacy_requests%rowtype;
  v_document jsonb;
begin
  select * into v_customer from public.customers c
   where c.id = p_customer_id and c.merged_at is null;
  if not found then raise exception 'Customer not found' using errcode = 'P0001'; end if;

  select * into v_existing from public.customer_privacy_requests r where r.id = p_request_id;
  if found and (v_existing.customer_reference_digest <> v_digest or v_existing.request_type <> 'export') then
    raise exception 'Privacy request id conflicts with another request' using errcode = 'P0001';
  end if;
  if not found then
    insert into public.customer_privacy_requests(
      id, customer_id, customer_reference_digest, request_type, status, idempotency_key,
      metadata
    ) values (
      p_request_id, p_customer_id, v_digest, 'export', 'processing', p_request_id::text,
      jsonb_build_object('format', 'json', 'schemaVersion', 1)
    );
  end if;

  v_document := jsonb_build_object(
    'schemaVersion', 1,
    'generatedAt', clock_timestamp(),
    'profile', jsonb_build_object(
      'name', v_customer.name,
      'email', v_customer.email,
      'phone', v_customer.phone,
      'memberSince', v_customer.created_at
    ),
    'orders', coalesce((
      select jsonb_agg(jsonb_build_object(
        'reference', o.id,
        'restaurant', jsonb_build_object('slug', r.slug, 'name', r.name),
        'status', o.status,
        'total', o.total,
        'items', o.items,
        'placedAt', o.created_at,
        'paidAt', o.paid_at,
        'cancelReason', o.cancel_reason
      ) order by o.created_at desc)
      from public.orders o
      join public.restaurants r on r.id = o.restaurant_id
      where o.customer_id = p_customer_id and o.deleted_at is null
    ), '[]'::jsonb),
    'favorites', coalesce((
      select jsonb_agg(jsonb_build_object(
        'restaurant', jsonb_build_object('slug', r.slug, 'name', r.name),
        'item', jsonb_build_object('name', item.name),
        'savedAt', favorite.created_at
      ) order by favorite.created_at desc)
      from public.customer_favorites favorite
      join public.restaurants r on r.id = favorite.restaurant_id
      join public.menu_items item on item.id = favorite.menu_item_id
      where favorite.customer_id = p_customer_id
    ), '[]'::jsonb),
    'consents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'restaurant', jsonb_build_object('slug', r.slug, 'name', r.name),
        'type', event.consent_type,
        'action', event.action,
        'policyVersion', event.policy_version,
        'lawfulBasis', event.lawful_basis,
        'source', event.source,
        'occurredAt', event.occurred_at
      ) order by event.occurred_at)
      from public.customer_consent_events event
      join public.restaurants r on r.id = event.restaurant_id
      where event.customer_id = p_customer_id
    ), '[]'::jsonb),
    'loyalty', coalesce((
      select jsonb_agg(jsonb_build_object(
        'restaurant', jsonb_build_object('slug', r.slug, 'name', r.name),
        'type', ledger.type,
        'direction', ledger.direction,
        'delta', ledger.delta,
        'reason', ledger.reason,
        'occurredAt', ledger.created_at
      ) order by ledger.created_at)
      from public.loyalty_transactions ledger
      join public.restaurants r on r.id = ledger.restaurant_id
      where ledger.customer_id = p_customer_id
    ), '[]'::jsonb)
  );

  update public.customer_privacy_requests
     set status = 'completed',
         payload_digest = encode(extensions.digest(v_document::text, 'sha256'), 'hex'),
         completed_at = clock_timestamp()
   where id = p_request_id;

  return jsonb_build_object(
    'requestId', p_request_id,
    'status', 'completed',
    'fileName', 'masabu-verilerim-' || to_char(current_date, 'YYYY-MM-DD') || '.json',
    'data', v_document
  );
end;
$$;

create or replace function public.request_customer_account_deletion(
  p_customer_id uuid,
  p_request_id uuid,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_digest text := encode(extensions.digest(p_customer_id::text, 'sha256'), 'hex');
  v_existing public.customer_privacy_requests%rowtype;
begin
  if p_confirmation <> 'HESABIMI SİL' then
    raise exception 'Deletion confirmation is invalid' using errcode = '22023';
  end if;
  if not exists (select 1 from public.customers c where c.id = p_customer_id and c.merged_at is null) then
    raise exception 'Customer not found' using errcode = 'P0001';
  end if;

  select * into v_existing from public.customer_privacy_requests r where r.id = p_request_id;
  if found and (v_existing.customer_reference_digest <> v_digest or v_existing.request_type <> 'delete') then
    raise exception 'Privacy request id conflicts with another request' using errcode = 'P0001';
  end if;
  if not found then
    insert into public.customer_privacy_requests(
      id, customer_id, customer_reference_digest, request_type, status,
      idempotency_key, metadata
    ) values (
      p_request_id, p_customer_id, v_digest, 'delete', 'pending_review',
      p_request_id::text,
      jsonb_build_object('requiresReverification', true, 'preserveFinancialRecords', true)
    );
  end if;

  select * into v_existing from public.customer_privacy_requests r where r.id = p_request_id;
  return jsonb_build_object(
    'requestId', v_existing.id,
    'status', v_existing.status,
    'requestedAt', v_existing.requested_at,
    'message', 'Talebin yeniden doğrulama ve hukuki inceleme sırasına alındı.'
  );
end;
$$;

revoke all on function public.create_customer_privacy_export(uuid, uuid) from public, anon, authenticated;
revoke all on function public.request_customer_account_deletion(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.create_customer_privacy_export(uuid, uuid) to service_role;
grant execute on function public.request_customer_account_deletion(uuid, uuid, text) to service_role;

notify pgrst, 'reload schema';
