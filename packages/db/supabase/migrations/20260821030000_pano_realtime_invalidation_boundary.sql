-- Pano consumes one narrow, section-authorized invalidation row instead of
-- receiving full rows from operational tables. The authoritative state still
-- comes from the server-side Pano read model after each version change.

create table if not exists public.pano_invalidations (
  restaurant_id uuid primary key references public.restaurants(id) on delete cascade,
  version bigint not null default 0 check (version >= 0),
  source text not null check (source in (
    'orders', 'table_sessions', 'payment_shares', 'service_requests', 'tables'
  )),
  updated_at timestamptz not null default clock_timestamp()
);

alter table public.pano_invalidations enable row level security;
alter table public.pano_invalidations replica identity full;

revoke all on public.pano_invalidations from public, anon, authenticated;
grant select (restaurant_id, version, source, updated_at)
  on public.pano_invalidations to authenticated;

drop policy if exists pano_invalidations_read on public.pano_invalidations;
create policy pano_invalidations_read on public.pano_invalidations
  for select to authenticated
  using (public.has_restaurant_section(restaurant_id, 'pano'));

create or replace function public.bump_pano_invalidation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_restaurant_id uuid;
begin
  if tg_op = 'DELETE' then
    v_restaurant_id := old.restaurant_id;
  else
    v_restaurant_id := new.restaurant_id;
  end if;

  insert into public.pano_invalidations (restaurant_id, version, source, updated_at)
  values (v_restaurant_id, 1, tg_table_name, clock_timestamp())
  on conflict (restaurant_id) do update
    set version = public.pano_invalidations.version + 1,
        source = excluded.source,
        updated_at = excluded.updated_at;

  return null;
end;
$$;

revoke all on function public.bump_pano_invalidation() from public, anon, authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'orders', 'table_sessions', 'payment_shares', 'service_requests', 'tables'
  ] loop
    execute format('drop trigger if exists pano_invalidate_after_change on public.%I', table_name);
    execute format(
      'create trigger pano_invalidate_after_change after insert or update or delete on public.%I for each row execute function public.bump_pano_invalidation()',
      table_name
    );
  end loop;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'pano_invalidations'
  ) then
    alter publication supabase_realtime add table public.pano_invalidations;
  end if;
end;
$$;

-- Payment-share rows are an account-operation concern. Pano no longer needs
-- direct row access; table operators keep their scoped read access.
drop policy if exists staff_read_payment_shares on public.payment_shares;
create policy staff_read_payment_shares on public.payment_shares
  for select to authenticated
  using (public.has_restaurant_section(restaurant_id, 'tables'));
