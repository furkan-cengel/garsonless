-- Keep the owner privacy export executable with pgcrypto installed in the
-- Supabase-managed `extensions` schema. The original function used an
-- unqualified digest call while its fixed search_path excludes that schema.

begin;

create or replace function public.export_owner_tenant_privacy_data(
  p_restaurant_id uuid,
  p_actor_user_id uuid,
  p_reason text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_restaurant public.restaurants%rowtype;
  v_existing public.tenant_privacy_operations%rowtype;
  v_created public.tenant_privacy_operations%rowtype;
  v_document jsonb;
  v_summary jsonb;
  v_digest text;
begin
  if length(trim(coalesce(p_reason, ''))) not between 3 and 500 or p_request_id is null then
    raise exception 'privacy_request_invalid' using errcode = '22023';
  end if;
  select * into v_restaurant from public.restaurants
    where id = p_restaurant_id and owner_id = p_actor_user_id and deleted_at is null;
  if not found then raise exception 'privacy_request_access_denied' using errcode = '42501'; end if;

  with customer_ids as (
    select customer_id from public.customer_restaurants where restaurant_id = p_restaurant_id
    union select customer_id from public.orders where restaurant_id = p_restaurant_id and customer_id is not null
    union select customer_id from public.loyalty_transactions where restaurant_id = p_restaurant_id
    union select customer_id from public.customer_consents where restaurant_id = p_restaurant_id
    union select customer_id from public.payment_shares where restaurant_id = p_restaurant_id and customer_id is not null
    union select customer_id from public.campaign_recipients where restaurant_id = p_restaurant_id
  )
  select jsonb_build_object(
    'schemaVersion', 1,
    'generatedAt', clock_timestamp(),
    'tenant', jsonb_build_object(
      'id', v_restaurant.id, 'name', v_restaurant.name, 'slug', v_restaurant.slug,
      'timezone', v_restaurant.timezone, 'createdAt', v_restaurant.created_at
    ),
    'customers', coalesce(jsonb_agg(jsonb_build_object(
      'id', customer.id, 'name', customer.name, 'email', customer.email,
      'phone', customer.phone, 'verifiedAt', customer.verified_at,
      'consents', coalesce((select jsonb_agg(jsonb_build_object(
        'type', consent_type, 'grantedAt', granted_at, 'revokedAt', revoked_at, 'source', source
      ) order by created_at) from public.customer_consents where restaurant_id = p_restaurant_id and customer_id = customer.id), '[]'::jsonb),
      'orders', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'status', status, 'total', total, 'paymentMethod', payment_method, 'createdAt', created_at
      ) order by created_at) from public.orders where restaurant_id = p_restaurant_id and customer_id = customer.id), '[]'::jsonb),
      'loyalty', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'type', type, 'delta', delta, 'reason', reason, 'direction', direction, 'createdAt', created_at
      ) order by created_at) from public.loyalty_transactions where restaurant_id = p_restaurant_id and customer_id = customer.id), '[]'::jsonb),
      'paymentShares', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'amount', amount, 'method', method, 'status', status, 'createdAt', created_at
      ) order by created_at) from public.payment_shares where restaurant_id = p_restaurant_id and customer_id = customer.id), '[]'::jsonb),
      'campaignRecipients', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'campaignId', campaign_id, 'phone', phone, 'status', status, 'sentAt', sent_at, 'createdAt', created_at
      ) order by created_at) from public.campaign_recipients where restaurant_id = p_restaurant_id and customer_id = customer.id), '[]'::jsonb)
    ) order by customer.created_at), '[]'::jsonb)
  ) into v_document
  from customer_ids ids join public.customers customer on customer.id = ids.customer_id;

  v_digest := encode(
    extensions.digest(convert_to(v_document::text, 'utf8'), 'sha256'::text),
    'hex'
  );
  v_summary := jsonb_build_object(
    'customerCount', jsonb_array_length(v_document->'customers'),
    'schemaVersion', 1
  );
  select * into v_existing from public.tenant_privacy_operations where request_id = p_request_id;
  if found then
    if v_existing.restaurant_id <> p_restaurant_id or v_existing.requested_by <> p_actor_user_id
      or v_existing.operation_type <> 'export' or v_existing.reason <> trim(p_reason)
      or v_existing.result_digest is distinct from v_digest then
      raise exception 'privacy_request_conflict' using errcode = '23505';
    end if;
    return jsonb_build_object('id', v_existing.id, 'status', v_existing.status,
      'duplicate', true, 'digest', v_digest, 'document', v_document);
  end if;
  insert into public.tenant_privacy_operations (
    restaurant_id, requested_by, operation_type, status, reason, result_digest,
    result_summary, request_id
  ) values (
    p_restaurant_id, p_actor_user_id, 'export', 'completed', trim(p_reason),
    v_digest, v_summary, p_request_id
  ) returning * into v_created;
  return jsonb_build_object('id', v_created.id, 'status', v_created.status,
    'duplicate', false, 'digest', v_digest, 'document', v_document);
end;
$$;

revoke all on function public.export_owner_tenant_privacy_data(uuid,uuid,text,uuid)
  from public, anon, authenticated;
grant execute on function public.export_owner_tenant_privacy_data(uuid,uuid,text,uuid)
  to service_role;

comment on function public.export_owner_tenant_privacy_data(uuid,uuid,text,uuid) is
  'Exports owner tenant privacy data transiently and stores only a pgcrypto SHA-256 digest plus summary evidence.';

commit;
