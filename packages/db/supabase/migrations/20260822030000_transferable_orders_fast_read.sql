-- One service-only round trip for the account-transfer picker. The caller is
-- still authenticated by the dashboard server; this boundary independently
-- verifies the actor's tenant/section access before returning order data.

create or replace function public.read_transferable_session_orders_bundle(
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
  v_plan text;
  v_authorized boolean := false;
  v_entitlement_context jsonb;
  v_orders jsonb;
begin
  select restaurant.plan,
    restaurant.owner_id = p_actor_user_id
    or exists (
      select 1
      from public.restaurant_members member
      where member.restaurant_id = restaurant.id
        and member.user_id = p_actor_user_id
        and member.status = 'active'
        and member.permissions ? 'tables'
    )
    or exists (
      select 1
      from public.organization_restaurants link
      join public.organizations organization
        on organization.id = link.organization_id
       and organization.status = 'active'
      join public.organization_members member
        on member.organization_id = link.organization_id
       and member.user_id = p_actor_user_id
       and member.status = 'active'
      where link.restaurant_id = restaurant.id
        and (
          member.role in ('owner', 'admin')
          or (member.role = 'member' and member.permissions ? 'tables')
        )
    )
  into v_plan, v_authorized
  from public.restaurants restaurant
  where restaurant.id = p_restaurant_id
    and restaurant.deleted_at is null;

  if not found or not coalesce(v_authorized, false) then
    return jsonb_build_object('authorized', false);
  end if;

  select public.read_restaurant_entitlement_context(
    p_restaurant_id,
    'table_management'
  ) into v_entitlement_context;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', orders.id,
        'total', orders.total,
        'paid_at', orders.paid_at,
        'items', orders.items
      ) order by orders.created_at asc
    ),
    '[]'::jsonb
  ) into v_orders
  from public.orders orders
  where orders.restaurant_id = p_restaurant_id
    and orders.table_session_id = p_session_id
    and orders.deleted_at is null
    and orders.status <> 'cancelled';

  return jsonb_build_object(
    'authorized', true,
    'plan', v_plan,
    'entitlementContext', v_entitlement_context,
    'orders', v_orders
  );
end;
$$;

revoke all on function public.read_transferable_session_orders_bundle(uuid,uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.read_transferable_session_orders_bundle(uuid,uuid,uuid)
  to service_role;

comment on function public.read_transferable_session_orders_bundle(uuid,uuid,uuid) is
  'Service-only account-transfer read: verifies direct or organization tables access and returns entitlement context plus tenant/session-scoped orders.';
