-- Customers slice 1: replay-safe manual credit and verified identity claims.
-- All write entrypoints remain service-role only. Browser roles never receive
-- direct access to global identity, merge audit, request, or ledger rows.

-- ── 1. Manual store-credit request ledger ───────────────────────────────────

create table public.manual_store_credit_requests (
  request_id uuid primary key,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete restrict,
  scope_key uuid not null,
  points integer not null check (points between 1 and 1000000),
  note text,
  granted_by uuid references auth.users(id) on delete set null,
  loyalty_transaction_id uuid,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  check (note is null or char_length(note) <= 80)
);

alter table public.manual_store_credit_requests enable row level security;
revoke all on table public.manual_store_credit_requests from public, anon, authenticated;
grant select, insert, update on table public.manual_store_credit_requests to service_role;

alter table public.loyalty_transactions
  add column manual_credit_request_id uuid
    references public.manual_store_credit_requests(request_id) on delete restrict;

create unique index loyalty_transactions_manual_credit_request_uniq
  on public.loyalty_transactions(manual_credit_request_id)
  where manual_credit_request_id is not null;

alter table public.manual_store_credit_requests
  add constraint manual_store_credit_requests_loyalty_transaction_id_fkey
  foreign key (loyalty_transaction_id)
  references public.loyalty_transactions(id) on delete restrict;

create or replace function public.grant_store_credit_atomic(
  p_request_id uuid,
  p_restaurant_id uuid,
  p_customer_id uuid,
  p_scope_key uuid,
  p_points integer,
  p_note text,
  p_granted_by uuid
)
returns table (granted integer, replayed boolean, transaction_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.manual_store_credit_requests;
  v_transaction_id uuid;
  v_note text := nullif(btrim(p_note), '');
  v_expected_scope uuid;
begin
  if p_request_id is null or p_restaurant_id is null or p_customer_id is null
     or p_granted_by is null or p_points is null or p_points < 1 or p_points > 1000000
     or (v_note is not null and char_length(v_note) > 80) then
    raise exception 'invalid manual credit request' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.restaurants restaurant
    where restaurant.id = p_restaurant_id
      and restaurant.owner_id = p_granted_by
      and restaurant.deleted_at is null
  ) then
    raise exception 'manual credit requires restaurant owner' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.orders orders
    where orders.restaurant_id = p_restaurant_id
      and orders.customer_id = p_customer_id
      and orders.deleted_at is null
    union all
    select 1 from public.loyalty_transactions ledger
    where ledger.restaurant_id = p_restaurant_id
      and ledger.customer_id = p_customer_id
    union all
    select 1 from public.customer_restaurants association
    where association.restaurant_id = p_restaurant_id
      and association.customer_id = p_customer_id
  ) then
    raise exception 'customer does not belong to restaurant' using errcode = '42501';
  end if;

  select case
    when restaurant.settings -> 'loyalty' ->> 'scope' = 'network'
      then '00000000-0000-0000-0000-000000000000'::uuid
    else restaurant.id
  end
  into v_expected_scope
  from public.restaurants restaurant
  where restaurant.id = p_restaurant_id;

  if p_scope_key is distinct from v_expected_scope then
    raise exception 'loyalty scope mismatch' using errcode = '42501';
  end if;

  insert into public.manual_store_credit_requests (
    request_id, restaurant_id, customer_id, scope_key, points, note, granted_by
  ) values (
    p_request_id, p_restaurant_id, p_customer_id, p_scope_key, p_points, v_note, p_granted_by
  )
  on conflict (request_id) do nothing;

  select * into v_existing
  from public.manual_store_credit_requests request
  where request.request_id = p_request_id
  for update;

  if v_existing.restaurant_id is distinct from p_restaurant_id
     or v_existing.customer_id is distinct from p_customer_id
     or v_existing.scope_key is distinct from p_scope_key
     or v_existing.points is distinct from p_points
     or v_existing.note is distinct from v_note
     or v_existing.granted_by is distinct from p_granted_by then
    raise exception 'manual credit request id reused with different intent' using errcode = 'GL001';
  end if;

  if v_existing.loyalty_transaction_id is not null then
    return query select v_existing.points, true, v_existing.loyalty_transaction_id;
    return;
  end if;

  insert into public.loyalty_transactions (
    customer_id, restaurant_id, scope_key, type, delta, direction, reason,
    granted_by, manual_credit_request_id
  ) values (
    p_customer_id, p_restaurant_id, p_scope_key, 'points', p_points, 'earn',
    case when v_note is null then 'store_credit' else 'store_credit:' || v_note end,
    p_granted_by, p_request_id
  ) returning id into v_transaction_id;

  update public.manual_store_credit_requests request
  set loyalty_transaction_id = v_transaction_id,
      completed_at = now()
  where request.request_id = p_request_id;

  return query select p_points, false, v_transaction_id;
end;
$$;

revoke all on function public.grant_store_credit_atomic(uuid, uuid, uuid, uuid, integer, text, uuid)
  from public, anon, authenticated;
grant execute on function public.grant_store_credit_atomic(uuid, uuid, uuid, uuid, integer, text, uuid)
  to service_role;

-- ── 2. Verified global identity claims and merge audit ───────────────────────

alter table public.customers
  add column merged_into_customer_id uuid references public.customers(id) on delete restrict,
  add column merged_at timestamptz,
  add constraint customers_merge_state_check check (
    (merged_into_customer_id is null and merged_at is null)
    or (merged_into_customer_id is not null and merged_at is not null and merged_into_customer_id <> id)
  );

create table public.customer_identity_claims (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  kind text not null check (kind in ('email', 'phone')),
  normalized_value text not null check (char_length(normalized_value) between 3 and 320),
  verified_at timestamptz not null,
  source text not null check (source in ('backfill', 'supabase_auth')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kind, normalized_value)
);

create index customer_identity_claims_customer_idx
  on public.customer_identity_claims(customer_id, kind);

alter table public.customer_identity_claims enable row level security;
revoke all on table public.customer_identity_claims from public, anon, authenticated;
grant select, insert, update, delete on table public.customer_identity_claims to service_role;

create table public.customer_identity_merge_audit (
  id uuid primary key default gen_random_uuid(),
  survivor_customer_id uuid not null references public.customers(id) on delete restrict,
  merged_customer_id uuid not null references public.customers(id) on delete restrict,
  triggered_by uuid references auth.users(id) on delete set null,
  reason text not null check (reason in ('verified_email_phone_claim')),
  moved_orders integer not null,
  moved_ledger_rows integer not null,
  moved_payment_shares integer not null,
  merged_consents integer not null,
  created_at timestamptz not null default now(),
  unique (merged_customer_id)
);

alter table public.customer_identity_merge_audit enable row level security;
revoke all on table public.customer_identity_merge_audit from public, anon, authenticated;
grant select, insert on table public.customer_identity_merge_audit to service_role;

insert into public.customer_identity_claims (customer_id, kind, normalized_value, verified_at, source)
select customer.id, 'email', lower(btrim(customer.email)), coalesce(customer.verified_at, customer.created_at), 'backfill'
from public.customers customer
where nullif(btrim(customer.email), '') is not null
on conflict (kind, normalized_value) do nothing;

insert into public.customer_identity_claims (customer_id, kind, normalized_value, verified_at, source)
select customer.id, 'phone', btrim(customer.phone), coalesce(customer.verified_at, customer.created_at), 'backfill'
from public.customers customer
where nullif(btrim(customer.phone), '') is not null
on conflict (kind, normalized_value) do nothing;

create or replace function public.merge_customer_identity_into(
  p_survivor uuid,
  p_merged uuid,
  p_triggered_by uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_survivor public.customers;
  v_merged public.customers;
  v_orders integer := 0;
  v_ledger integer := 0;
  v_shares integer := 0;
  v_consents integer := 0;
begin
  if p_survivor is null or p_merged is null or p_survivor = p_merged then
    raise exception 'invalid customer identity merge' using errcode = '22023';
  end if;

  select * into v_survivor from public.customers where id = p_survivor for update;
  select * into v_merged from public.customers where id = p_merged for update;
  if v_survivor.id is null or v_merged.id is null or v_merged.merged_into_customer_id is not null then
    raise exception 'customer identity merge target unavailable' using errcode = '22023';
  end if;
  if v_survivor.auth_user_id is not null and v_survivor.auth_user_id <> p_triggered_by then
    raise exception 'survivor belongs to another auth account' using errcode = '42501';
  end if;
  if v_merged.auth_user_id is not null and v_merged.auth_user_id <> p_triggered_by then
    raise exception 'merged identity belongs to another auth account' using errcode = '42501';
  end if;

  -- Combining two already-awarded welcome bonuses would silently inflate the
  -- balance. Keep that ambiguous case fail-closed for a reviewed support merge.
  if exists (
    select 1
    from public.loyalty_transactions survivor_ledger
    join public.loyalty_transactions merged_ledger
      on merged_ledger.scope_key = survivor_ledger.scope_key
     and merged_ledger.type = survivor_ledger.type
     and merged_ledger.reason = 'welcome'
     and survivor_ledger.reason = 'welcome'
    where survivor_ledger.customer_id = p_survivor
      and merged_ledger.customer_id = p_merged
  ) then
    raise exception 'identity merge requires manual loyalty review' using errcode = 'GL002';
  end if;

  update public.orders set customer_id = p_survivor where customer_id = p_merged;
  get diagnostics v_orders = row_count;

  update public.loyalty_transactions set customer_id = p_survivor where customer_id = p_merged;
  get diagnostics v_ledger = row_count;

  update public.payment_shares set customer_id = p_survivor where customer_id = p_merged;
  get diagnostics v_shares = row_count;

  insert into public.customer_restaurants (customer_id, restaurant_id, source, linked_at)
  select p_survivor, association.restaurant_id, association.source, association.linked_at
  from public.customer_restaurants association
  where association.customer_id = p_merged
  on conflict (customer_id, restaurant_id) do update
    set linked_at = least(public.customer_restaurants.linked_at, excluded.linked_at);
  delete from public.customer_restaurants where customer_id = p_merged;

  insert into public.customer_consents (
    customer_id, restaurant_id, consent_type, granted_at, revoked_at, source,
    created_at, updated_at
  )
  select p_survivor, consent.restaurant_id, consent.consent_type, consent.granted_at,
         consent.revoked_at, consent.source, consent.created_at, consent.updated_at
  from public.customer_consents consent
  where consent.customer_id = p_merged
  on conflict (customer_id, restaurant_id, consent_type) do update set
    granted_at = case when excluded.updated_at >= public.customer_consents.updated_at then excluded.granted_at else public.customer_consents.granted_at end,
    revoked_at = case when excluded.updated_at >= public.customer_consents.updated_at then excluded.revoked_at else public.customer_consents.revoked_at end,
    source = case when excluded.updated_at >= public.customer_consents.updated_at then excluded.source else public.customer_consents.source end,
    created_at = least(public.customer_consents.created_at, excluded.created_at),
    updated_at = greatest(public.customer_consents.updated_at, excluded.updated_at);
  get diagnostics v_consents = row_count;
  delete from public.customer_consents where customer_id = p_merged;

  update public.customer_identity_claims
  set customer_id = p_survivor, updated_at = now()
  where customer_id = p_merged;

  -- Messaging recipient/event rows intentionally remain bound to the historical
  -- customer row: their phone/provider snapshots are immutable delivery audit.
  update public.customers
  set auth_user_id = null,
      email = null,
      phone = null,
      name = null,
      verified_at = null,
      merged_into_customer_id = p_survivor,
      merged_at = now()
  where id = p_merged;

  insert into public.customer_identity_merge_audit (
    survivor_customer_id, merged_customer_id, triggered_by, reason,
    moved_orders, moved_ledger_rows, moved_payment_shares, merged_consents
  ) values (
    p_survivor, p_merged, p_triggered_by, 'verified_email_phone_claim',
    v_orders, v_ledger, v_shares, v_consents
  );
end;
$$;

revoke all on function public.merge_customer_identity_into(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;

create or replace function public.claim_customer_identity_atomic(
  p_auth_user_id uuid,
  p_email text,
  p_name text,
  p_verified_phone text default null
)
returns table (id uuid, email text, name text, merged boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(btrim(p_email));
  v_phone text := nullif(btrim(p_verified_phone), '');
  v_name text := nullif(left(btrim(p_name), 80), '');
  v_auth_customer uuid;
  v_email_customer uuid;
  v_phone_customer uuid;
  v_survivor uuid;
  v_existing_auth uuid;
  v_merged boolean := false;
begin
  if p_auth_user_id is null or v_email is null or v_email = '' or position('@' in v_email) < 2 then
    raise exception 'verified email is required' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('customer-email:' || v_email, 0));
  if v_phone is not null then
    perform pg_advisory_xact_lock(hashtextextended('customer-phone:' || v_phone, 0));
  end if;

  select customer.id into v_auth_customer
  from public.customers customer
  where customer.auth_user_id = p_auth_user_id
    and customer.merged_into_customer_id is null
  for update;

  select claim.customer_id into v_email_customer
  from public.customer_identity_claims claim
  where claim.kind = 'email' and claim.normalized_value = v_email
  for update;
  if v_email_customer is null then
    select customer.id into v_email_customer
    from public.customers customer
    where lower(customer.email) = v_email and customer.merged_into_customer_id is null
    for update;
  end if;

  if v_phone is not null then
    select claim.customer_id into v_phone_customer
    from public.customer_identity_claims claim
    where claim.kind = 'phone' and claim.normalized_value = v_phone
    for update;
    if v_phone_customer is null then
      select customer.id into v_phone_customer
      from public.customers customer
      where customer.phone = v_phone and customer.merged_into_customer_id is null
      for update;
    end if;
  end if;

  v_survivor := coalesce(v_auth_customer, v_email_customer, v_phone_customer);
  if v_survivor is null then
    insert into public.customers as inserted_customer (auth_user_id, email, phone, name, verified_at)
    values (p_auth_user_id, v_email, v_phone, v_name, now())
    returning inserted_customer.id into v_survivor;
  end if;

  select customer.auth_user_id into v_existing_auth
  from public.customers customer where customer.id = v_survivor for update;
  if v_existing_auth is not null and v_existing_auth <> p_auth_user_id then
    raise exception 'verified identity belongs to another auth account' using errcode = '42501';
  end if;

  if v_auth_customer is not null and v_auth_customer <> v_survivor then
    perform public.merge_customer_identity_into(v_survivor, v_auth_customer, p_auth_user_id);
    v_merged := true;
  end if;
  if v_email_customer is not null and v_email_customer <> v_survivor then
    perform public.merge_customer_identity_into(v_survivor, v_email_customer, p_auth_user_id);
    v_merged := true;
  end if;
  if v_phone_customer is not null and v_phone_customer <> v_survivor then
    perform public.merge_customer_identity_into(v_survivor, v_phone_customer, p_auth_user_id);
    v_merged := true;
  end if;

  update public.customers customer
  set auth_user_id = p_auth_user_id,
      email = v_email,
      phone = coalesce(v_phone, customer.phone),
      name = coalesce(v_name, customer.name),
      verified_at = now()
  where customer.id = v_survivor;

  insert into public.customer_identity_claims (
    customer_id, kind, normalized_value, verified_at, source
  ) values (
    v_survivor, 'email', v_email, now(), 'supabase_auth'
  ) on conflict (kind, normalized_value) do update set
    customer_id = excluded.customer_id,
    verified_at = excluded.verified_at,
    source = excluded.source,
    updated_at = now();

  if v_phone is not null then
    insert into public.customer_identity_claims (
      customer_id, kind, normalized_value, verified_at, source
    ) values (
      v_survivor, 'phone', v_phone, now(), 'supabase_auth'
    ) on conflict (kind, normalized_value) do update set
      customer_id = excluded.customer_id,
      verified_at = excluded.verified_at,
      source = excluded.source,
      updated_at = now();
  end if;

  return query
  select customer.id, customer.email, customer.name, v_merged
  from public.customers customer
  where customer.id = v_survivor;
end;
$$;

revoke all on function public.claim_customer_identity_atomic(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.claim_customer_identity_atomic(uuid, text, text, text)
  to service_role;
