-- Sprint 18a: table/session/order/service-request cross-tenant hardening.
-- Add composite restaurant+table integrity for new writes without validating
-- historical rows yet, then make the table-session RPC verify ownership.

create unique index if not exists tables_restaurant_id_id_uidx
  on public.tables(restaurant_id, id);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_restaurant_table_fkey'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_restaurant_table_fkey
      foreign key (restaurant_id, table_id)
      references public.tables(restaurant_id, id)
      not valid;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'table_sessions_restaurant_table_fkey'
      and conrelid = 'public.table_sessions'::regclass
  ) then
    alter table public.table_sessions
      add constraint table_sessions_restaurant_table_fkey
      foreign key (restaurant_id, table_id)
      references public.tables(restaurant_id, id)
      not valid;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'service_requests_restaurant_table_fkey'
      and conrelid = 'public.service_requests'::regclass
  ) then
    alter table public.service_requests
      add constraint service_requests_restaurant_table_fkey
      foreign key (restaurant_id, table_id)
      references public.tables(restaurant_id, id)
      not valid;
  end if;
end $$;

create or replace function public.open_or_get_table_session(p_restaurant_id uuid, p_table_id uuid)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  if not exists (
    select 1
    from public.tables t
    where t.id = p_table_id
      and t.restaurant_id = p_restaurant_id
      and t.deleted_at is null
  ) then
    raise exception 'table_not_found_for_restaurant' using errcode = 'P0002';
  end if;

  update public.table_sessions s
  set closed_at = now(), updated_at = now()
  where s.restaurant_id = p_restaurant_id
    and s.table_id = p_table_id
    and s.closed_at is null
    and s.opened_at < now() - interval '8 hours'
    and not exists (
      select 1
      from public.orders o
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

  if v_id is null then
    raise exception 'failed_to_open_table_session';
  end if;

  return v_id;
end $$;

revoke execute on function public.open_or_get_table_session(uuid, uuid) from public;
revoke execute on function public.open_or_get_table_session(uuid, uuid) from anon, authenticated;
