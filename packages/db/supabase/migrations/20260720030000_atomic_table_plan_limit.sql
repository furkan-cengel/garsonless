-- SaaS table entitlement: the count check and table insert must share one
-- restaurant-row lock. A dashboard-side count followed by an insert would let
-- concurrent requests cross the plan cap.
create or replace function public.create_table_with_plan_limit(
  p_restaurant_id uuid,
  p_label text
)
returns table (
  outcome text,
  table_id uuid,
  token uuid,
  table_limit integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_plan text;
  v_limit integer;
  v_count integer;
  v_label text := nullif(btrim(p_label), '');
  v_table_id uuid;
  v_token uuid;
begin
  if v_label is null then
    return query select 'invalid_label'::text, null::uuid, null::uuid, null::integer;
    return;
  end if;

  -- Serializes new-table requests and a concurrent plan change per tenant.
  select r.plan into v_plan
  from public.restaurants r
  where r.id = p_restaurant_id
    and r.deleted_at is null
  for update;

  if not found then
    return query select 'restaurant_not_found'::text, null::uuid, null::uuid, null::integer;
    return;
  end if;

  -- Mirrors the canonical @garsonless/domain entitlement catalogue. This is
  -- deliberately database-local because this function is the atomic backstop.
  v_limit := case v_plan
    when 'free' then 3
    when 'starter' then 10
    when 'pro' then 50
    when 'enterprise' then null
    else 3 -- fail closed for unexpected persisted values
  end;

  if v_limit is not null then
    select count(*)::integer into v_count
    from public.tables t
    where t.restaurant_id = p_restaurant_id
      and t.deleted_at is null;

    if v_count >= v_limit then
      return query select 'plan_limit'::text, null::uuid, null::uuid, v_limit;
      return;
    end if;
  end if;

  insert into public.tables (restaurant_id, label)
  values (p_restaurant_id, v_label)
  returning id into v_table_id;

  -- The after-insert QR trigger has already issued exactly one active public
  -- token before control returns here.
  select q.token into v_token
  from public.table_qr_tokens q
  where q.restaurant_id = p_restaurant_id
    and q.table_id = v_table_id
    and q.revoked_at is null
  limit 1;

  if v_token is null then
    raise exception 'table_qr_token_missing' using errcode = 'P0001';
  end if;

  return query select 'created'::text, v_table_id, v_token, v_limit;
exception
  when unique_violation then
    return query select 'duplicate_label'::text, null::uuid, null::uuid, v_limit;
end;
$$;

revoke all on function public.create_table_with_plan_limit(uuid, text) from public, anon, authenticated;
grant execute on function public.create_table_with_plan_limit(uuid, text) to service_role;
