-- Expand the service-only transfer timeline with the immutable request and
-- session outcome metadata needed by the operational audit UI. Actor UUIDs
-- remain server-side inputs for a privacy-safe label projection.

drop function if exists public.list_table_transfer_history(uuid, integer);

create function public.list_table_transfer_history(
  p_restaurant_id uuid,
  p_limit integer default 50
)
returns table(
  id uuid,
  kind text,
  source_table_id uuid,
  target_table_id uuid,
  source_session_id uuid,
  target_session_id uuid,
  status text,
  request_id uuid,
  source_session_closed boolean,
  target_session_created boolean,
  created_by uuid,
  created_at timestamptz,
  undone_by uuid,
  undone_at timestamptz,
  lock_reason text,
  order_count bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    operation.id,
    operation.kind,
    operation.source_table_id,
    operation.target_table_id,
    operation.source_session_id,
    operation.target_session_id,
    operation.status,
    operation.request_id,
    operation.source_session_closed,
    operation.target_session_created,
    operation.created_by,
    operation.created_at,
    operation.undone_by,
    operation.undone_at,
    operation.lock_reason,
    count(transfer_order.order_id)
  from public.table_transfer_operations operation
  left join public.table_transfer_orders transfer_order
    on transfer_order.operation_id = operation.id
  where operation.restaurant_id = p_restaurant_id
  group by operation.id
  order by operation.created_at desc
  limit least(greatest(p_limit, 1), 100)
$$;

revoke all on function public.list_table_transfer_history(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.list_table_transfer_history(uuid, integer)
  to service_role;
