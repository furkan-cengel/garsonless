-- Customers CRM phase 1: team notes on a customer, an audit trail for every
-- contact reveal, and owner-only point deductions with a required reason.
-- Every table and RPC here is service-role only; dashboard actions check the
-- actor before calling them and the RPCs re-check tenancy and ownership.

-- ── 1. Team notes ────────────────────────────────────────────────────────────

create table public.customer_notes (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 500),
  author_id uuid references auth.users(id) on delete set null,
  author_label text not null check (char_length(author_label) between 1 and 80),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null
);

create index customer_notes_customer_idx
  on public.customer_notes(restaurant_id, customer_id, created_at desc)
  where deleted_at is null;

alter table public.customer_notes enable row level security;
revoke all on table public.customer_notes from public, anon, authenticated;
grant select, insert, update on table public.customer_notes to service_role;

create or replace function public.customer_belongs_to_restaurant(p_restaurant_id uuid, p_customer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.orders o
    where o.restaurant_id = p_restaurant_id and o.customer_id = p_customer_id and o.deleted_at is null
    union all
    select 1 from public.loyalty_transactions l
    where l.restaurant_id = p_restaurant_id and l.customer_id = p_customer_id
    union all
    select 1 from public.customer_restaurants a
    where a.restaurant_id = p_restaurant_id and a.customer_id = p_customer_id
  );
$$;

revoke all on function public.customer_belongs_to_restaurant(uuid, uuid) from public, anon, authenticated;
grant execute on function public.customer_belongs_to_restaurant(uuid, uuid) to service_role;

create or replace function public.add_customer_note(
  p_restaurant_id uuid,
  p_customer_id uuid,
  p_author_id uuid,
  p_body text
)
returns table (id uuid, body text, author_id uuid, author_label text, created_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_body text := btrim(coalesce(p_body, ''));
  v_label text;
begin
  if p_restaurant_id is null or p_customer_id is null or p_author_id is null
     or char_length(v_body) not between 1 and 500 then
    raise exception 'invalid customer note' using errcode = '22023';
  end if;
  if not public.customer_belongs_to_restaurant(p_restaurant_id, p_customer_id) then
    raise exception 'customer does not belong to restaurant' using errcode = '42501';
  end if;

  select left(coalesce(
    nullif(btrim(u.raw_user_meta_data->>'display_name'), ''),
    nullif(btrim(u.raw_user_meta_data->>'full_name'), ''),
    nullif(btrim(u.raw_user_meta_data->>'name'), ''),
    'Ekip üyesi'
  ), 80)
  into v_label
  from auth.users u where u.id = p_author_id;

  return query
  insert into public.customer_notes as note (restaurant_id, customer_id, body, author_id, author_label)
  values (p_restaurant_id, p_customer_id, v_body, p_author_id, coalesce(v_label, 'Ekip üyesi'))
  returning note.id, note.body, note.author_id, note.author_label, note.created_at;
end;
$$;

revoke all on function public.add_customer_note(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.add_customer_note(uuid, uuid, uuid, text) to service_role;

-- ── 2. Contact reveal audit ─────────────────────────────────────────────────

create table public.customer_contact_reveals (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  revealed_by uuid references auth.users(id) on delete set null,
  revealed_at timestamptz not null default now()
);

create index customer_contact_reveals_customer_idx
  on public.customer_contact_reveals(restaurant_id, customer_id, revealed_at desc);

alter table public.customer_contact_reveals enable row level security;
revoke all on table public.customer_contact_reveals from public, anon, authenticated;
grant select, insert on table public.customer_contact_reveals to service_role;

-- ── 3. Owner point deductions ───────────────────────────────────────────────

create table public.manual_point_deduction_requests (
  request_id uuid primary key,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete restrict,
  scope_key uuid not null,
  points integer not null check (points between 1 and 1000000),
  reason text not null check (char_length(reason) between 1 and 80),
  deducted_by uuid references auth.users(id) on delete set null,
  -- No foreign key: tenant privacy erasure deletes ledger rows and must not be blocked.
  loyalty_transaction_id uuid,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.manual_point_deduction_requests enable row level security;
revoke all on table public.manual_point_deduction_requests from public, anon, authenticated;
grant select, insert, update on table public.manual_point_deduction_requests to service_role;

alter table public.loyalty_transactions
  add column manual_deduction_request_id uuid
    references public.manual_point_deduction_requests(request_id) on delete restrict;

create unique index loyalty_transactions_manual_deduction_request_uniq
  on public.loyalty_transactions(manual_deduction_request_id)
  where manual_deduction_request_id is not null;

-- A deduction is a 'reversal': it lowers both the spendable balance and the
-- lifetime points that drive the tier, mirroring how a manual credit raises both.
create or replace function public.deduct_customer_points_atomic(
  p_request_id uuid,
  p_restaurant_id uuid,
  p_customer_id uuid,
  p_scope_key uuid,
  p_points integer,
  p_reason text,
  p_deducted_by uuid
)
returns table (deducted integer, replayed boolean, transaction_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.manual_point_deduction_requests;
  v_transaction_id uuid;
  v_reason text := nullif(btrim(p_reason), '');
  v_expected_scope uuid;
  v_balance integer;
begin
  if p_request_id is null or p_restaurant_id is null or p_customer_id is null
     or p_deducted_by is null or p_points is null or p_points < 1 or p_points > 1000000
     or v_reason is null or char_length(v_reason) > 80 then
    raise exception 'invalid manual deduction request' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.restaurants restaurant
    where restaurant.id = p_restaurant_id
      and restaurant.owner_id = p_deducted_by
      and restaurant.deleted_at is null
  ) then
    raise exception 'manual deduction requires restaurant owner' using errcode = '42501';
  end if;

  if not public.customer_belongs_to_restaurant(p_restaurant_id, p_customer_id) then
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

  -- Same lock key as order redemptions so a deduction and a checkout cannot both spend the balance.
  perform pg_advisory_xact_lock(hashtext(p_customer_id::text || ':' || p_scope_key::text));

  insert into public.manual_point_deduction_requests (
    request_id, restaurant_id, customer_id, scope_key, points, reason, deducted_by
  ) values (
    p_request_id, p_restaurant_id, p_customer_id, p_scope_key, p_points, v_reason, p_deducted_by
  )
  on conflict (request_id) do nothing;

  select * into v_existing
  from public.manual_point_deduction_requests request
  where request.request_id = p_request_id
  for update;

  if v_existing.restaurant_id is distinct from p_restaurant_id
     or v_existing.customer_id is distinct from p_customer_id
     or v_existing.scope_key is distinct from p_scope_key
     or v_existing.points is distinct from p_points
     or v_existing.reason is distinct from v_reason
     or v_existing.deducted_by is distinct from p_deducted_by then
    raise exception 'manual deduction request id reused with different intent' using errcode = 'GL001';
  end if;

  if v_existing.loyalty_transaction_id is not null then
    return query select v_existing.points, true, v_existing.loyalty_transaction_id;
    return;
  end if;

  select coalesce(sum(delta), 0) into v_balance
  from public.loyalty_transactions
  where customer_id = p_customer_id and scope_key = p_scope_key and type = 'points';

  if v_balance < p_points then
    raise exception 'insufficient points balance' using errcode = 'GL002';
  end if;

  insert into public.loyalty_transactions (
    customer_id, restaurant_id, scope_key, type, delta, direction, reason,
    granted_by, manual_deduction_request_id
  ) values (
    p_customer_id, p_restaurant_id, p_scope_key, 'points', -p_points, 'reversal',
    'manual_deduction:' || v_reason, p_deducted_by, p_request_id
  ) returning id into v_transaction_id;

  update public.manual_point_deduction_requests request
  set loyalty_transaction_id = v_transaction_id,
      completed_at = now()
  where request.request_id = p_request_id;

  return query select p_points, false, v_transaction_id;
end;
$$;

revoke all on function public.deduct_customer_points_atomic(uuid, uuid, uuid, uuid, integer, text, uuid)
  from public, anon, authenticated;
grant execute on function public.deduct_customer_points_atomic(uuid, uuid, uuid, uuid, integer, text, uuid)
  to service_role;

-- ── 4. Tenant privacy erasure covers the new customer data ──────────────────
-- Same body as 20260722201000 plus the three new tables.

create or replace function public.erase_platform_admin_tenant_privacy_data(
  p_restaurant_id uuid,
  p_actor_user_id uuid,
  p_actor_role text,
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
  v_operation public.platform_tenant_privacy_operations%rowtype;
  v_customer_ids uuid[] := '{}'::uuid[];
  v_summary jsonb;
  v_customer_count integer := 0;
  v_consent_count integer := 0;
  v_order_count integer := 0;
  v_loyalty_count integer := 0;
  v_campaign_count integer := 0;
  v_share_count integer := 0;
  v_anonymized_count integer := 0;
  v_note_count integer := 0;
begin
  if char_length(btrim(coalesce(p_reason, ''))) not between 10 and 1000 or p_request_id is null then
    raise exception 'platform_privacy_input_invalid' using errcode = '22023';
  end if;
  select * into v_identity from public.platform_admin_users where user_id = p_actor_user_id for update;
  if not found or v_identity.status <> 'active' or v_identity.role <> p_actor_role or v_identity.role <> 'superadmin' then
    raise exception 'platform_privacy_not_authorized' using errcode = '42501';
  end if;
  perform 1 from public.restaurants where id = p_restaurant_id and deleted_at is null for update;
  if not found then raise exception 'platform_tenant_not_found' using errcode = 'P0002'; end if;

  select * into v_operation from public.platform_tenant_privacy_operations where request_id = p_request_id;
  if found then
    if v_operation.restaurant_id <> p_restaurant_id or v_operation.operation_type <> 'erase' or v_operation.requested_by <> p_actor_user_id then
      raise exception 'platform_privacy_request_conflict' using errcode = '23505';
    end if;
    return jsonb_build_object('operation', jsonb_build_object('id', v_operation.id, 'restaurantId', v_operation.restaurant_id, 'type', v_operation.operation_type, 'status', v_operation.status, 'reason', v_operation.reason, 'summary', v_operation.result_summary, 'requestedBy', v_operation.requested_by, 'requestId', v_operation.request_id, 'createdAt', v_operation.created_at, 'completedAt', v_operation.completed_at), 'duplicate', true);
  end if;

  select coalesce(array_agg(customer_id), '{}'::uuid[]), count(*) into v_customer_ids, v_customer_count
  from (
    select customer_id from public.customer_restaurants where restaurant_id = p_restaurant_id
    union select customer_id from public.orders where restaurant_id = p_restaurant_id and customer_id is not null
    union select customer_id from public.loyalty_transactions where restaurant_id = p_restaurant_id
    union select customer_id from public.customer_consents where restaurant_id = p_restaurant_id
    union select customer_id from public.payment_shares where restaurant_id = p_restaurant_id and customer_id is not null
    union select customer_id from public.campaign_recipients where restaurant_id = p_restaurant_id
    union select customer_id from public.message_events where restaurant_id = p_restaurant_id and customer_id is not null
    union select customer_id from public.customer_notes where restaurant_id = p_restaurant_id
  ) ids;

  select count(*) into v_consent_count from public.customer_consents where restaurant_id = p_restaurant_id;
  select count(*) into v_order_count from public.orders where restaurant_id = p_restaurant_id and customer_id is not null;
  select count(*) into v_loyalty_count from public.loyalty_transactions where restaurant_id = p_restaurant_id;
  select count(*) into v_campaign_count from public.campaign_recipients where restaurant_id = p_restaurant_id;
  select count(*) into v_share_count from public.payment_shares where restaurant_id = p_restaurant_id and customer_id is not null;
  select count(*) into v_note_count from public.customer_notes where restaurant_id = p_restaurant_id;

  update public.orders set customer_id = null, customer_tier = null where restaurant_id = p_restaurant_id and customer_id is not null;
  update public.payment_shares set customer_id = null, label = null where restaurant_id = p_restaurant_id and customer_id is not null;
  update public.message_events set customer_id = null, recipient_id = null, phone = null, provider_message_id = null, error = null, metadata = '{}'::jsonb where restaurant_id = p_restaurant_id and customer_id is not null;
  delete from public.campaign_recipients where restaurant_id = p_restaurant_id;
  delete from public.customer_consents where restaurant_id = p_restaurant_id;
  delete from public.customer_notes where restaurant_id = p_restaurant_id;
  delete from public.customer_contact_reveals where restaurant_id = p_restaurant_id;
  delete from public.loyalty_transactions where restaurant_id = p_restaurant_id;
  delete from public.manual_point_deduction_requests where restaurant_id = p_restaurant_id;
  delete from public.customer_restaurants where restaurant_id = p_restaurant_id;

  update public.customers customer set name = null, phone = null, email = null, auth_user_id = null, verified_at = null
  where customer.id = any(v_customer_ids)
    and not exists (select 1 from public.customer_restaurants x where x.customer_id = customer.id)
    and not exists (select 1 from public.orders x where x.customer_id = customer.id)
    and not exists (select 1 from public.loyalty_transactions x where x.customer_id = customer.id)
    and not exists (select 1 from public.customer_consents x where x.customer_id = customer.id)
    and not exists (select 1 from public.payment_shares x where x.customer_id = customer.id)
    and not exists (select 1 from public.campaign_recipients x where x.customer_id = customer.id)
    and not exists (select 1 from public.message_events x where x.customer_id = customer.id)
    and not exists (select 1 from public.customer_notes x where x.customer_id = customer.id);
  get diagnostics v_anonymized_count = row_count;

  v_summary := jsonb_build_object('customerCount', v_customer_count, 'consentCount', v_consent_count, 'orderLinkCount', v_order_count, 'loyaltyRowCount', v_loyalty_count, 'campaignRecipientCount', v_campaign_count, 'paymentShareLinkCount', v_share_count, 'customerNoteCount', v_note_count, 'anonymizedGlobalCustomerCount', v_anonymized_count);
  insert into public.platform_tenant_privacy_operations (restaurant_id, operation_type, status, reason, result_summary, requested_by, request_id)
  values (p_restaurant_id, 'erase', 'completed', btrim(p_reason), v_summary, p_actor_user_id, p_request_id)
  returning * into v_operation;
  insert into public.platform_admin_audit_log (actor_user_id, actor_role, action, target_type, target_id, reason, request_id, before_state, after_state)
  values (p_actor_user_id, v_identity.role, 'tenant.privacy.erase', 'restaurant', p_restaurant_id::text, btrim(p_reason), p_request_id,
    jsonb_build_object('customerCount', v_customer_count), jsonb_build_object('operationId', v_operation.id, 'summary', v_summary, 'billingRecordsPreserved', true, 'operationalOrdersPreserved', true));

  return jsonb_build_object('operation', jsonb_build_object('id', v_operation.id, 'restaurantId', v_operation.restaurant_id, 'type', v_operation.operation_type, 'status', v_operation.status, 'reason', v_operation.reason, 'summary', v_operation.result_summary, 'requestedBy', v_operation.requested_by, 'requestId', v_operation.request_id, 'createdAt', v_operation.created_at, 'completedAt', v_operation.completed_at), 'duplicate', false);
end;
$$;

revoke all on function public.erase_platform_admin_tenant_privacy_data(uuid,uuid,text,text,uuid) from public, anon, authenticated;
grant execute on function public.erase_platform_admin_tenant_privacy_data(uuid,uuid,text,text,uuid) to service_role;
