-- KDS reads are a dedicated projection, not full orders rows. The database
-- clock is captured before the query so snapshot/delta cursors cannot miss a
-- write that races the read. Terminal and soft-deleted rows become tombstones
-- in delta mode, allowing the browser to remove stale cards.

create index if not exists idx_orders_restaurant_updated_at
  on public.orders (restaurant_id, updated_at);

create or replace function public.read_kitchen_order_projection(
  p_restaurant_id uuid,
  p_after timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cursor timestamptz := clock_timestamp();
  v_after timestamptz := case
    when p_after is null then null
    else least(p_after, v_cursor)
  end;
  v_active_statuses constant text[] := array[
    'pending',
    'pending_approval',
    'sent_to_kitchen',
    'paid',
    'preparing',
    'ready'
  ];
  v_orders jsonb;
begin
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', o.id,
      'status', o.status,
      'table_id', o.table_id,
      'items', o.items,
      'customer_tier', o.customer_tier,
      'paid_at', o.paid_at,
      'created_at', o.created_at,
      'updated_at', o.updated_at,
      'active', o.deleted_at is null and o.status = any(v_active_statuses)
    ) order by o.updated_at, o.id
  ), '[]'::jsonb)
  into v_orders
  from public.orders o
  where o.restaurant_id = p_restaurant_id
    and o.updated_at <= v_cursor
    and (
      (v_after is null and o.deleted_at is null and o.status = any(v_active_statuses))
      or
      (v_after is not null and o.updated_at > v_after)
    );

  return jsonb_build_object(
    'cursor', v_cursor,
    'snapshot', v_after is null,
    'orders', v_orders
  );
end;
$$;

revoke all on function public.read_kitchen_order_projection(uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.read_kitchen_order_projection(uuid, timestamptz)
  to service_role;
