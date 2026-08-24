-- Fast, service-only reads for staff-critical table operations. The dashboard
-- authenticates the actor with Supabase Auth; these functions independently
-- re-check direct and Business organization access before returning data.

create or replace function public.read_tables_command_access_bundle(
  p_restaurant_id uuid,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_plan text;
  v_authorized boolean := false;
  v_audit_labels_allowed boolean := false;
  v_entitlement_context jsonb;
begin
  select restaurant.plan,
    restaurant.owner_id = p_actor_user_id
    or exists (
      select 1 from public.restaurant_members member
      where member.restaurant_id = restaurant.id
        and member.user_id = p_actor_user_id
        and member.status = 'active'
        and member.permissions ? 'tables'
    )
    or exists (
      select 1
      from public.organization_restaurants link
      join public.organizations organization
        on organization.id = link.organization_id and organization.status = 'active'
      join public.organization_members member
        on member.organization_id = link.organization_id
       and member.user_id = p_actor_user_id and member.status = 'active'
      where link.restaurant_id = restaurant.id
        and (member.role in ('owner', 'admin') or (member.role = 'member' and member.permissions ? 'tables'))
    ),
    restaurant.owner_id = p_actor_user_id
    or exists (
      select 1
      from public.organization_restaurants link
      join public.organization_members member
        on member.organization_id = link.organization_id
       and member.user_id = p_actor_user_id and member.status = 'active'
      join public.organizations organization
        on organization.id = link.organization_id and organization.status = 'active'
      where link.restaurant_id = restaurant.id and member.role in ('owner', 'admin')
    )
  into v_plan, v_authorized, v_audit_labels_allowed
  from public.restaurants restaurant
  where restaurant.id = p_restaurant_id and restaurant.deleted_at is null;

  if not found or not coalesce(v_authorized, false) then
    return jsonb_build_object('authorized', false);
  end if;

  select public.read_restaurant_entitlement_context(p_restaurant_id, 'table_management')
  into v_entitlement_context;

  return jsonb_build_object(
    'authorized', true,
    'auditLabelsAllowed', v_audit_labels_allowed,
    'plan', v_plan,
    'entitlementContext', v_entitlement_context
  );
end;
$$;

create or replace function public.read_session_settlement_bundle(
  p_restaurant_id uuid,
  p_session_id uuid,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_access jsonb;
  v_orders jsonb;
  v_shares jsonb;
  v_staff_labels jsonb := '[]'::jsonb;
begin
  select public.read_tables_command_access_bundle(p_restaurant_id, p_actor_user_id)
  into v_access;
  if coalesce((v_access ->> 'authorized')::boolean, false) is not true then
    return jsonb_build_object('authorized', false);
  end if;

  select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.created_at), '[]'::jsonb)
  into v_orders
  from (
    select orders.id, orders.total, orders.status, orders.paid_at,
      orders.payment_method, orders.settled_by, orders.created_at, orders.items
    from public.orders orders
    where orders.restaurant_id = p_restaurant_id
      and orders.table_session_id = p_session_id
      and orders.deleted_at is null and orders.status <> 'cancelled'
  ) row_data;

  select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.created_at), '[]'::jsonb)
  into v_shares
  from (
    select share.id, share.amount, share.method, share.status, share.label,
      share.settled_at, share.settled_by, share.created_at
    from public.payment_shares share
    where share.restaurant_id = p_restaurant_id
      and share.table_session_id = p_session_id and share.status <> 'void'
  ) row_data;

  if coalesce((v_access ->> 'auditLabelsAllowed')::boolean, false) then
    select coalesce(jsonb_agg(jsonb_build_object('userId', staff.user_id, 'email', staff.email)), '[]'::jsonb)
    into v_staff_labels
    from (
      select member.user_id, member.email
      from public.restaurant_members member
      where member.restaurant_id = p_restaurant_id
        and member.user_id is not null and member.status = 'active'
      union
      select actor.id, actor.email
      from auth.users actor
      where actor.id = p_actor_user_id and actor.email is not null
    ) staff;
  end if;

  return v_access || jsonb_build_object(
    'orders', v_orders,
    'shares', v_shares,
    'staffLabels', v_staff_labels
  );
end;
$$;

create or replace function public.settle_session_and_close_atomic(
  p_restaurant_id uuid,
  p_session_id uuid,
  p_actor_user_id uuid,
  p_settlements jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_access jsonb;
  v_input_count integer;
  v_matched_count integer;
  v_outcome text;
  v_settled_order_ids jsonb;
begin
  select public.read_tables_command_access_bundle(p_restaurant_id, p_actor_user_id)
  into v_access;
  if coalesce((v_access ->> 'authorized')::boolean, false) is not true then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if jsonb_typeof(p_settlements) <> 'array' then
    raise exception 'invalid_settlements' using errcode = '22023';
  end if;

  select count(*) into v_input_count from jsonb_array_elements(p_settlements);
  if v_input_count > 500 then raise exception 'too_many_settlements' using errcode = '22023'; end if;
  if exists (
    select 1 from jsonb_to_recordset(p_settlements) as entry(order_id uuid, method text)
    where entry.order_id is null or entry.method not in ('cash', 'pos', 'comp')
  ) then raise exception 'invalid_settlement_entry' using errcode = '22023'; end if;
  if (
    select count(distinct entry.order_id)
    from jsonb_to_recordset(p_settlements) as entry(order_id uuid, method text)
  ) <> v_input_count then raise exception 'duplicate_settlement_order' using errcode = '22023'; end if;

  perform 1 from public.table_sessions session
  where session.id = p_session_id and session.restaurant_id = p_restaurant_id
  for update;
  if not found then return jsonb_build_object('outcome', 'not_found', 'settledOrderIds', '[]'::jsonb); end if;

  select count(*) into v_matched_count
  from jsonb_to_recordset(p_settlements) as entry(order_id uuid, method text)
  join public.orders orders on orders.id = entry.order_id
    and orders.restaurant_id = p_restaurant_id
    and orders.table_session_id = p_session_id
    and orders.deleted_at is null and orders.status <> 'cancelled';
  if v_matched_count <> v_input_count then
    raise exception 'settlement_order_scope_mismatch' using errcode = '22023';
  end if;

  with entries as (
    select entry.order_id, entry.method
    from jsonb_to_recordset(p_settlements) as entry(order_id uuid, method text)
  ), settled as (
    update public.orders orders
    set paid_at = now(), payment_method = entries.method,
      settled_by = p_actor_user_id, updated_at = now()
    from entries
    where orders.id = entries.order_id
      and orders.restaurant_id = p_restaurant_id
      and orders.table_session_id = p_session_id
      and orders.deleted_at is null and orders.status <> 'cancelled'
      and orders.paid_at is null
    returning orders.id
  )
  select coalesce(jsonb_agg(id), '[]'::jsonb) into v_settled_order_ids from settled;

  select public.close_table_session_atomic(p_session_id, p_restaurant_id, null)
  into v_outcome;
  return jsonb_build_object('outcome', v_outcome, 'settledOrderIds', v_settled_order_ids);
end;
$$;

revoke all on function public.read_tables_command_access_bundle(uuid,uuid),
  public.read_session_settlement_bundle(uuid,uuid,uuid),
  public.settle_session_and_close_atomic(uuid,uuid,uuid,jsonb)
  from public, anon, authenticated;
grant execute on function public.read_tables_command_access_bundle(uuid,uuid),
  public.read_session_settlement_bundle(uuid,uuid,uuid),
  public.settle_session_and_close_atomic(uuid,uuid,uuid,jsonb)
  to service_role;

comment on function public.read_tables_command_access_bundle(uuid,uuid) is
  'Service-only tables command gate projection with tenant access and entitlement context.';
comment on function public.read_session_settlement_bundle(uuid,uuid,uuid) is
  'Service-only settlement read combining access, entitlement, orders, shares and owner-visible staff labels.';
comment on function public.settle_session_and_close_atomic(uuid,uuid,uuid,jsonb) is
  'Service-only, tenant-scoped atomic manual settlement and normal table close command.';
