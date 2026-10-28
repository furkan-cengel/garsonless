-- Customers phase 3: a short review question after a paid visit.
--
-- An owner switches the question on and may add the venue's Google review link.
-- Twenty minutes after a signed-in customer's QR order is paid, the menu asks
-- for 1-5 stars, at most once per customer and restaurant in 30 days. Every
-- answer offers the Google link (no review gating); 1-3 stars also let the
-- customer write to the business. Low ratings stay open on the customer profile
-- and in Pano until someone marks them handled. "Not now" is stored as a row
-- without a rating, so it also counts toward the 30 days.

create table public.customer_review_settings (
  restaurant_id uuid primary key references public.restaurants(id) on delete cascade,
  enabled boolean not null default false,
  google_url text check (google_url is null or (google_url ~ '^https://[^[:space:]]+$' and char_length(google_url) <= 500)),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
alter table public.customer_review_settings enable row level security;
revoke all on table public.customer_review_settings from public, anon, authenticated;
grant all on table public.customer_review_settings to service_role;

create table public.customer_feedback (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  -- A visit is a table session, or a single order when it had none.
  visit_key uuid not null,
  rating smallint check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  handled_at timestamptz,
  handled_by uuid references auth.users(id) on delete set null,
  unique (restaurant_id, customer_id, visit_key),
  check (comment is null or rating is not null)
);
create index customer_feedback_customer on public.customer_feedback(restaurant_id, customer_id, created_at desc);
create index customer_feedback_open_low on public.customer_feedback(restaurant_id, created_at desc)
  where rating <= 3 and handled_at is null;
alter table public.customer_feedback enable row level security;
revoke all on table public.customer_feedback from public, anon, authenticated;
grant all on table public.customer_feedback to service_role;

-- The visit to ask about, or null. availableAt may be in the future (paid less
-- than 20 minutes ago) so an open menu can wait for it.
create or replace function public.customer_review_prompt(p_restaurant uuid, p_customer uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare settings public.customer_review_settings; visit record;
begin
  select * into settings from public.customer_review_settings s where s.restaurant_id = p_restaurant and s.enabled;
  if not found then return null; end if;
  if exists (select 1 from public.customer_feedback f
             where f.restaurant_id = p_restaurant and f.customer_id = p_customer and f.created_at > now() - interval '30 days') then
    return null;
  end if;
  select coalesce(o.table_session_id, o.id) as visit_key, max(o.paid_at) as paid_at into visit
  from public.orders o
  where o.restaurant_id = p_restaurant and o.customer_id = p_customer and o.deleted_at is null
    and o.status::text <> 'cancelled' and o.payment_method is distinct from 'comp'
    and o.paid_at > now() - interval '24 hours'
  group by 1 order by 2 desc limit 1;
  if not found then return null; end if;
  return jsonb_build_object('visitKey', visit.visit_key, 'availableAt', visit.paid_at + interval '20 minutes', 'googleUrl', settings.google_url);
end $$;

-- Records stars (or a "not now" without stars) and, for 1-3 stars, a comment.
-- The same visit may be answered in two steps: stars first, then the comment.
create or replace function public.submit_customer_feedback(p_restaurant uuid, p_customer uuid, p_visit_key uuid, p_rating integer, p_comment text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare saved_id uuid; clean_comment text := nullif(btrim(coalesce(p_comment, '')), '');
begin
  if (p_rating is not null and p_rating not between 1 and 5) or char_length(clean_comment) > 1000
     or (clean_comment is not null and (p_rating is null or p_rating > 3)) then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  if not exists (select 1 from public.customer_review_settings s where s.restaurant_id = p_restaurant and s.enabled) then
    raise exception 'reviews_disabled' using errcode = '42501';
  end if;
  -- The visit must be this customer's, paid at least ~20 minutes ago and within two days.
  if not exists (
    select 1 from public.orders o
    where o.restaurant_id = p_restaurant and o.customer_id = p_customer and coalesce(o.table_session_id, o.id) = p_visit_key
      and o.deleted_at is null and o.status::text <> 'cancelled' and o.payment_method is distinct from 'comp'
      and o.paid_at between now() - interval '48 hours' and now() - interval '19 minutes'
  ) then
    raise exception 'visit_not_found' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.customer_feedback f
             where f.restaurant_id = p_restaurant and f.customer_id = p_customer and f.visit_key <> p_visit_key
               and f.created_at > now() - interval '30 days') then
    raise exception 'already_answered' using errcode = '23505';
  end if;
  insert into public.customer_feedback as f (restaurant_id, customer_id, visit_key, rating, comment)
  values (p_restaurant, p_customer, p_visit_key, p_rating, clean_comment)
  on conflict (restaurant_id, customer_id, visit_key) do update set
    -- Stars are given once; a comment can follow them once.
    rating = coalesce(f.rating, excluded.rating),
    comment = case when coalesce(f.rating, excluded.rating) <= 3 then coalesce(f.comment, excluded.comment) else f.comment end,
    updated_at = now()
  returning f.id into saved_id;
  return saved_id;
end $$;

create or replace function public.save_customer_review_settings(p_restaurant uuid, p_actor uuid, p_enabled boolean, p_google_url text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare saved public.customer_review_settings;
begin
  if not exists (select 1 from public.restaurants r where r.id = p_restaurant and r.owner_id = p_actor and r.deleted_at is null) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.customer_review_settings as s (restaurant_id, enabled, google_url, updated_at, updated_by)
  values (p_restaurant, coalesce(p_enabled, false), nullif(btrim(coalesce(p_google_url, '')), ''), now(), p_actor)
  on conflict (restaurant_id) do update set enabled = excluded.enabled, google_url = excluded.google_url, updated_at = now(), updated_by = excluded.updated_by
  returning * into saved;
  return jsonb_build_object('enabled', saved.enabled, 'googleUrl', saved.google_url);
end $$;

revoke all on function public.customer_review_prompt(uuid, uuid), public.submit_customer_feedback(uuid, uuid, uuid, integer, text),
  public.save_customer_review_settings(uuid, uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.customer_review_prompt(uuid, uuid), public.submit_customer_feedback(uuid, uuid, uuid, integer, text),
  public.save_customer_review_settings(uuid, uuid, boolean, text) to service_role;

-- A customer's data export also carries birthdays (phase 2) and their own feedback.
-- Body otherwise as 20260802030000.
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
    ), '[]'::jsonb),
    'birthdays', coalesce((
      select jsonb_agg(jsonb_build_object(
        'restaurant', jsonb_build_object('slug', r.slug, 'name', r.name),
        'month', link.birth_month,
        'day', link.birth_day
      ) order by r.name)
      from public.customer_restaurants link
      join public.restaurants r on r.id = link.restaurant_id
      where link.customer_id = p_customer_id and link.birth_month is not null
    ), '[]'::jsonb),
    'feedback', coalesce((
      select jsonb_agg(jsonb_build_object(
        'restaurant', jsonb_build_object('slug', r.slug, 'name', r.name),
        'rating', feedback.rating,
        'comment', feedback.comment,
        'givenAt', feedback.created_at
      ) order by feedback.created_at)
      from public.customer_feedback feedback
      join public.restaurants r on r.id = feedback.restaurant_id
      where feedback.customer_id = p_customer_id
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

-- Tenant privacy erasure also removes feedback and review settings.
-- Body otherwise as 20261029100000.
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
  delete from public.customer_reward_grants where restaurant_id = p_restaurant_id;
  delete from public.customer_reward_rules where restaurant_id = p_restaurant_id;
  delete from public.customer_feedback where restaurant_id = p_restaurant_id;
  delete from public.customer_review_settings where restaurant_id = p_restaurant_id;
  delete from public.customer_contact_reveals where restaurant_id = p_restaurant_id;
  -- Manual credit requests and their ledger rows reference each other; unlink before deleting both.
  update public.manual_store_credit_requests set loyalty_transaction_id = null where restaurant_id = p_restaurant_id;
  delete from public.loyalty_transactions where restaurant_id = p_restaurant_id;
  delete from public.manual_store_credit_requests where restaurant_id = p_restaurant_id;
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

notify pgrst, 'reload schema';
