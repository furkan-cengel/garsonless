-- Faz 6.9: superadmin-only, replay-safe tenant customer-data export and erasure.
-- Billing/fiscal records and anonymous operational order facts are deliberately
-- preserved. Export payloads are generated transiently and are never persisted.

create table public.platform_tenant_privacy_operations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  operation_type text not null check (operation_type in ('export', 'erase')),
  status text not null check (status in ('completed')),
  reason text not null check (char_length(btrim(reason)) between 10 and 1000),
  result_summary jsonb not null check (jsonb_typeof(result_summary) = 'object'),
  requested_by uuid not null references public.platform_admin_users(user_id) on delete restrict,
  request_id uuid not null unique,
  created_at timestamptz not null default now(),
  completed_at timestamptz not null default now()
);

create index platform_tenant_privacy_operations_tenant_idx
  on public.platform_tenant_privacy_operations (restaurant_id, created_at desc);

alter table public.platform_tenant_privacy_operations enable row level security;
revoke all on table public.platform_tenant_privacy_operations from public, anon, authenticated;
grant select, insert on table public.platform_tenant_privacy_operations to service_role;

create or replace function public.read_platform_admin_tenant_privacy_operations(
  p_restaurant_id uuid,
  p_actor_user_id uuid,
  p_actor_role text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_identity public.platform_admin_users%rowtype;
begin
  select * into v_identity from public.platform_admin_users where user_id = p_actor_user_id;
  if not found or v_identity.status <> 'active' or v_identity.role <> p_actor_role or v_identity.role <> 'superadmin' then
    raise exception 'platform_privacy_not_authorized' using errcode = '42501';
  end if;
  perform 1 from public.restaurants where id = p_restaurant_id and deleted_at is null;
  if not found then raise exception 'platform_tenant_not_found' using errcode = 'P0002'; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', operation.id,
      'restaurantId', operation.restaurant_id,
      'type', operation.operation_type,
      'status', operation.status,
      'reason', operation.reason,
      'summary', operation.result_summary,
      'requestedBy', operation.requested_by,
      'requestId', operation.request_id,
      'createdAt', operation.created_at,
      'completedAt', operation.completed_at
    ) order by operation.created_at desc)
    from (select * from public.platform_tenant_privacy_operations
      where restaurant_id = p_restaurant_id order by created_at desc limit 20) operation
  ), '[]'::jsonb);
end;
$$;

create or replace function public.export_platform_admin_tenant_privacy_data(
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
  v_restaurant public.restaurants%rowtype;
  v_operation public.platform_tenant_privacy_operations%rowtype;
  v_document jsonb;
  v_summary jsonb;
  v_duplicate boolean := false;
begin
  if char_length(btrim(coalesce(p_reason, ''))) not between 10 and 1000 or p_request_id is null then
    raise exception 'platform_privacy_input_invalid' using errcode = '22023';
  end if;
  select * into v_identity from public.platform_admin_users where user_id = p_actor_user_id for update;
  if not found or v_identity.status <> 'active' or v_identity.role <> p_actor_role or v_identity.role <> 'superadmin' then
    raise exception 'platform_privacy_not_authorized' using errcode = '42501';
  end if;
  select * into v_restaurant from public.restaurants where id = p_restaurant_id and deleted_at is null;
  if not found then raise exception 'platform_tenant_not_found' using errcode = 'P0002'; end if;

  select * into v_operation from public.platform_tenant_privacy_operations where request_id = p_request_id;
  if found then
    if v_operation.restaurant_id <> p_restaurant_id or v_operation.operation_type <> 'export' or v_operation.requested_by <> p_actor_user_id then
      raise exception 'platform_privacy_request_conflict' using errcode = '23505';
    end if;
    v_duplicate := true;
  end if;

  with customer_ids as (
    select customer_id from public.customer_restaurants where restaurant_id = p_restaurant_id
    union select customer_id from public.orders where restaurant_id = p_restaurant_id and customer_id is not null
    union select customer_id from public.loyalty_transactions where restaurant_id = p_restaurant_id
    union select customer_id from public.customer_consents where restaurant_id = p_restaurant_id
    union select customer_id from public.payment_shares where restaurant_id = p_restaurant_id and customer_id is not null
    union select customer_id from public.campaign_recipients where restaurant_id = p_restaurant_id
    union select customer_id from public.message_events where restaurant_id = p_restaurant_id and customer_id is not null
  )
  select jsonb_build_object(
    'schemaVersion', 1,
    'generatedAt', now(),
    'tenant', jsonb_build_object('id', v_restaurant.id, 'name', v_restaurant.name, 'slug', v_restaurant.slug, 'createdAt', v_restaurant.created_at),
    'customers', coalesce(jsonb_agg(jsonb_build_object(
      'id', customer.id,
      'name', customer.name,
      'email', customer.email,
      'phone', customer.phone,
      'verifiedAt', customer.verified_at,
      'consents', coalesce((select jsonb_agg(jsonb_build_object('type', consent_type, 'grantedAt', granted_at, 'revokedAt', revoked_at, 'source', source) order by created_at) from public.customer_consents where restaurant_id = p_restaurant_id and customer_id = customer.id), '[]'::jsonb),
      'orders', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'status', status, 'total', total, 'paymentMethod', payment_method, 'createdAt', created_at) order by created_at) from public.orders where restaurant_id = p_restaurant_id and customer_id = customer.id), '[]'::jsonb),
      'loyalty', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'type', type, 'delta', delta, 'reason', reason, 'direction', direction, 'createdAt', created_at) order by created_at) from public.loyalty_transactions where restaurant_id = p_restaurant_id and customer_id = customer.id), '[]'::jsonb),
      'paymentShares', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'amount', amount, 'method', method, 'status', status, 'createdAt', created_at) order by created_at) from public.payment_shares where restaurant_id = p_restaurant_id and customer_id = customer.id), '[]'::jsonb),
      'campaignRecipients', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'campaignId', campaign_id, 'phone', phone, 'status', status, 'sentAt', sent_at, 'createdAt', created_at) order by created_at) from public.campaign_recipients where restaurant_id = p_restaurant_id and customer_id = customer.id), '[]'::jsonb)
    ) order by customer.created_at), '[]'::jsonb)
  ) into v_document
  from customer_ids ids join public.customers customer on customer.id = ids.customer_id;

  v_summary := jsonb_build_object(
    'customerCount', jsonb_array_length(v_document->'customers'),
    'consentCount', (select count(*) from public.customer_consents where restaurant_id = p_restaurant_id),
    'orderLinkCount', (select count(*) from public.orders where restaurant_id = p_restaurant_id and customer_id is not null),
    'loyaltyRowCount', (select count(*) from public.loyalty_transactions where restaurant_id = p_restaurant_id),
    'campaignRecipientCount', (select count(*) from public.campaign_recipients where restaurant_id = p_restaurant_id),
    'paymentShareLinkCount', (select count(*) from public.payment_shares where restaurant_id = p_restaurant_id and customer_id is not null),
    'anonymizedGlobalCustomerCount', 0
  );

  if not v_duplicate then
    insert into public.platform_tenant_privacy_operations (restaurant_id, operation_type, status, reason, result_summary, requested_by, request_id)
    values (p_restaurant_id, 'export', 'completed', btrim(p_reason), v_summary, p_actor_user_id, p_request_id)
    returning * into v_operation;
    insert into public.platform_admin_audit_log (actor_user_id, actor_role, action, target_type, target_id, reason, request_id, before_state, after_state)
    values (p_actor_user_id, v_identity.role, 'tenant.privacy.export', 'restaurant', p_restaurant_id::text, btrim(p_reason), p_request_id, null,
      jsonb_build_object('operationId', v_operation.id, 'summary', v_summary));
  end if;

  return jsonb_build_object(
    'operation', jsonb_build_object('id', v_operation.id, 'restaurantId', v_operation.restaurant_id, 'type', v_operation.operation_type, 'status', v_operation.status, 'reason', v_operation.reason, 'summary', v_operation.result_summary, 'requestedBy', v_operation.requested_by, 'requestId', v_operation.request_id, 'createdAt', v_operation.created_at, 'completedAt', v_operation.completed_at),
    'document', v_document,
    'duplicate', v_duplicate
  );
end;
$$;

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
  ) ids;

  select count(*) into v_consent_count from public.customer_consents where restaurant_id = p_restaurant_id;
  select count(*) into v_order_count from public.orders where restaurant_id = p_restaurant_id and customer_id is not null;
  select count(*) into v_loyalty_count from public.loyalty_transactions where restaurant_id = p_restaurant_id;
  select count(*) into v_campaign_count from public.campaign_recipients where restaurant_id = p_restaurant_id;
  select count(*) into v_share_count from public.payment_shares where restaurant_id = p_restaurant_id and customer_id is not null;

  update public.orders set customer_id = null, customer_tier = null where restaurant_id = p_restaurant_id and customer_id is not null;
  update public.payment_shares set customer_id = null, label = null where restaurant_id = p_restaurant_id and customer_id is not null;
  update public.message_events set customer_id = null, recipient_id = null, phone = null, provider_message_id = null, error = null, metadata = '{}'::jsonb where restaurant_id = p_restaurant_id and customer_id is not null;
  delete from public.campaign_recipients where restaurant_id = p_restaurant_id;
  delete from public.customer_consents where restaurant_id = p_restaurant_id;
  delete from public.loyalty_transactions where restaurant_id = p_restaurant_id;
  delete from public.customer_restaurants where restaurant_id = p_restaurant_id;

  update public.customers customer set name = null, phone = null, email = null, auth_user_id = null, verified_at = null
  where customer.id = any(v_customer_ids)
    and not exists (select 1 from public.customer_restaurants x where x.customer_id = customer.id)
    and not exists (select 1 from public.orders x where x.customer_id = customer.id)
    and not exists (select 1 from public.loyalty_transactions x where x.customer_id = customer.id)
    and not exists (select 1 from public.customer_consents x where x.customer_id = customer.id)
    and not exists (select 1 from public.payment_shares x where x.customer_id = customer.id)
    and not exists (select 1 from public.campaign_recipients x where x.customer_id = customer.id)
    and not exists (select 1 from public.message_events x where x.customer_id = customer.id);
  get diagnostics v_anonymized_count = row_count;

  v_summary := jsonb_build_object('customerCount', v_customer_count, 'consentCount', v_consent_count, 'orderLinkCount', v_order_count, 'loyaltyRowCount', v_loyalty_count, 'campaignRecipientCount', v_campaign_count, 'paymentShareLinkCount', v_share_count, 'anonymizedGlobalCustomerCount', v_anonymized_count);
  insert into public.platform_tenant_privacy_operations (restaurant_id, operation_type, status, reason, result_summary, requested_by, request_id)
  values (p_restaurant_id, 'erase', 'completed', btrim(p_reason), v_summary, p_actor_user_id, p_request_id)
  returning * into v_operation;
  insert into public.platform_admin_audit_log (actor_user_id, actor_role, action, target_type, target_id, reason, request_id, before_state, after_state)
  values (p_actor_user_id, v_identity.role, 'tenant.privacy.erase', 'restaurant', p_restaurant_id::text, btrim(p_reason), p_request_id,
    jsonb_build_object('customerCount', v_customer_count), jsonb_build_object('operationId', v_operation.id, 'summary', v_summary, 'billingRecordsPreserved', true, 'operationalOrdersPreserved', true));

  return jsonb_build_object('operation', jsonb_build_object('id', v_operation.id, 'restaurantId', v_operation.restaurant_id, 'type', v_operation.operation_type, 'status', v_operation.status, 'reason', v_operation.reason, 'summary', v_operation.result_summary, 'requestedBy', v_operation.requested_by, 'requestId', v_operation.request_id, 'createdAt', v_operation.created_at, 'completedAt', v_operation.completed_at), 'duplicate', false);
end;
$$;

revoke all on function public.read_platform_admin_tenant_privacy_operations(uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.export_platform_admin_tenant_privacy_data(uuid,uuid,text,text,uuid) from public, anon, authenticated;
revoke all on function public.erase_platform_admin_tenant_privacy_data(uuid,uuid,text,text,uuid) from public, anon, authenticated;
grant execute on function public.read_platform_admin_tenant_privacy_operations(uuid,uuid,text) to service_role;
grant execute on function public.export_platform_admin_tenant_privacy_data(uuid,uuid,text,text,uuid) to service_role;
grant execute on function public.erase_platform_admin_tenant_privacy_data(uuid,uuid,text,text,uuid) to service_role;

comment on table public.platform_tenant_privacy_operations is 'PII-free append-only evidence for superadmin tenant privacy operations; export documents are never persisted.';
comment on function public.erase_platform_admin_tenant_privacy_data(uuid,uuid,text,text,uuid) is 'Tenant-scoped customer PII erasure preserving fiscal billing and anonymous operational facts.';
