-- Tables/QR hardening: keep money/session decisions and table deletion inside
-- Postgres transactions. These functions are service-role only; dashboard
-- server actions remain the user-facing authorization boundary.

create unique index if not exists tables_active_label_uidx
  on public.tables (restaurant_id, lower(btrim(label)))
  where deleted_at is null;

-- One unresolved call of a given type per table. This is the DB backstop for
-- concurrent/replayed public waiter-call requests; resolving the row frees the
-- key for a future call.
create unique index if not exists service_requests_one_pending_type_per_table_uidx
  on public.service_requests (restaurant_id, table_id, request_type)
  where status = 'pending';

create or replace function public.close_table_session_atomic(
  p_session_id uuid,
  p_restaurant_id uuid,
  p_abnormal_reason text default null
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session public.table_sessions%rowtype;
  v_has_unpaid boolean;
  v_reason text := nullif(btrim(p_abnormal_reason), '');
begin
  select * into v_session
  from public.table_sessions
  where id = p_session_id
    and restaurant_id = p_restaurant_id
  for update;

  if not found then return 'not_found'; end if;
  if v_session.closed_at is not null then return 'already_closed'; end if;

  select exists (
    select 1 from public.orders o
    where o.restaurant_id = p_restaurant_id
      and o.table_session_id = p_session_id
      and o.deleted_at is null
      and o.status <> 'cancelled'
      and o.paid_at is null
  ) into v_has_unpaid;

  if v_has_unpaid and v_reason is null then return 'unpaid'; end if;

  update public.table_sessions
  set closed_at = now(),
      updated_at = now(),
      close_reason = case when v_has_unpaid then left(v_reason, 200) else null end
  where id = p_session_id;

  return case when v_has_unpaid then 'closed_abnormal' else 'closed_normal' end;
end;
$$;

revoke all on function public.close_table_session_atomic(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.close_table_session_atomic(uuid, uuid, text) to service_role;

create or replace function public.soft_delete_table_atomic(
  p_table_id uuid,
  p_restaurant_id uuid
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_table public.tables%rowtype;
begin
  select * into v_table
  from public.tables
  where id = p_table_id
    and restaurant_id = p_restaurant_id
  for update;

  if not found or v_table.deleted_at is not null then return 'not_found'; end if;

  if exists (
    select 1 from public.table_sessions
    where restaurant_id = p_restaurant_id
      and table_id = p_table_id
      and closed_at is null
  ) then return 'open_session'; end if;

  update public.tables
  set deleted_at = now(), updated_at = now()
  where id = p_table_id;

  return 'deleted';
end;
$$;

revoke all on function public.soft_delete_table_atomic(uuid, uuid) from public, anon, authenticated;
grant execute on function public.soft_delete_table_atomic(uuid, uuid) to service_role;

-- Serialize first-order session opening with table deletion. The previous
-- existence check did not lock the table row, leaving a check/delete/insert
-- race that could create an open session for a just-deleted table.
create or replace function public.open_or_get_table_session(p_restaurant_id uuid, p_table_id uuid)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  perform 1
  from public.tables t
  where t.id = p_table_id
    and t.restaurant_id = p_restaurant_id
    and t.deleted_at is null
  for key share;

  if not found then
    raise exception 'table_not_found_for_restaurant' using errcode = 'P0002';
  end if;

  update public.table_sessions s
  set closed_at = now(), updated_at = now()
  where s.restaurant_id = p_restaurant_id
    and s.table_id = p_table_id
    and s.closed_at is null
    and s.opened_at < now() - interval '8 hours'
    and not exists (
      select 1 from public.orders o
      where o.table_session_id = s.id
        and o.restaurant_id = p_restaurant_id
        and o.created_at > now() - interval '8 hours'
    );

  insert into public.table_sessions (restaurant_id, table_id)
  values (p_restaurant_id, p_table_id)
  on conflict (table_id) where (closed_at is null) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id
    from public.table_sessions
    where restaurant_id = p_restaurant_id
      and table_id = p_table_id
      and closed_at is null
    limit 1;
  end if;

  if v_id is null then raise exception 'failed_to_open_table_session'; end if;
  return v_id;
end;
$$;

revoke execute on function public.open_or_get_table_session(uuid, uuid) from public, anon, authenticated;
grant execute on function public.open_or_get_table_session(uuid, uuid) to service_role;
