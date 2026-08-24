-- Menu clients subscribe to this minimal tenant-scoped boundary and fetch the
-- authoritative management model again after a version change. Operational
-- menu rows are never streamed directly to dashboard clients.

create table if not exists public.menu_invalidations (
  restaurant_id uuid primary key references public.restaurants(id) on delete cascade,
  version bigint not null default 0 check (version >= 0),
  source text not null check (source in (
    'menu_categories', 'menu_items', 'menu_item_recommendations'
  )),
  updated_at timestamptz not null default clock_timestamp()
);

alter table public.menu_invalidations enable row level security;
alter table public.menu_invalidations replica identity full;

revoke all on public.menu_invalidations from public, anon, authenticated;
grant select (restaurant_id, version, source, updated_at)
  on public.menu_invalidations to authenticated;

drop policy if exists menu_invalidations_read on public.menu_invalidations;
create policy menu_invalidations_read on public.menu_invalidations
  for select to authenticated
  using (public.has_restaurant_section(restaurant_id, 'menu'));

create or replace function public.bump_menu_invalidation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_restaurant_id uuid;
  v_category_id uuid;
begin
  if tg_table_name = 'menu_items' then
    if tg_op = 'DELETE' then
      v_category_id := old.category_id;
    else
      v_category_id := new.category_id;
    end if;
    select category.restaurant_id
      into v_restaurant_id
      from public.menu_categories category
      where category.id = v_category_id;
  elsif tg_op = 'DELETE' then
    v_restaurant_id := old.restaurant_id;
  else
    v_restaurant_id := new.restaurant_id;
  end if;

  if v_restaurant_id is null then
    return null;
  end if;

  insert into public.menu_invalidations (restaurant_id, version, source, updated_at)
  values (v_restaurant_id, 1, tg_table_name, clock_timestamp())
  on conflict (restaurant_id) do update
    set version = public.menu_invalidations.version + 1,
        source = excluded.source,
        updated_at = excluded.updated_at;

  return null;
end;
$$;

revoke all on function public.bump_menu_invalidation() from public, anon, authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'menu_categories', 'menu_items', 'menu_item_recommendations'
  ] loop
    execute format('drop trigger if exists menu_invalidate_after_change on public.%I', table_name);
    execute format(
      'create trigger menu_invalidate_after_change after insert or update or delete on public.%I for each row execute function public.bump_menu_invalidation()',
      table_name
    );
  end loop;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'menu_invalidations'
  ) then
    alter publication supabase_realtime add table public.menu_invalidations;
  end if;
end;
$$;

-- One transaction boundary for validated CSV batches. The function performs
-- its own tenant-section authorization because it runs as security definer.
create or replace function public.import_menu_rows(
  p_restaurant_id uuid,
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row jsonb;
  v_category public.menu_categories%rowtype;
  v_item public.menu_items%rowtype;
  v_categories jsonb := '[]'::jsonb;
  v_items jsonb := '[]'::jsonb;
  v_failures jsonb := '[]'::jsonb;
  v_category_key text;
  v_product_key text;
  v_position integer;
begin
  if auth.uid() is null
    or not public.has_restaurant_section(p_restaurant_id, 'menu') then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) <> 'array'
    or jsonb_array_length(p_rows) < 1
    or jsonb_array_length(p_rows) > 1000 then
    raise exception 'invalid import rows' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_restaurant_id::text, 0));

  for v_row in select value from jsonb_array_elements(p_rows) loop
    begin
      v_category_key := lower(trim(v_row ->> 'category'));
      v_product_key := lower(trim(v_row ->> 'name'));
      if v_category_key = '' or v_product_key = '' then
        raise exception 'invalid row' using errcode = '22023';
      end if;

      select category.*
        into v_category
        from public.menu_categories category
        where category.restaurant_id = p_restaurant_id
          and category.parent_id is null
          and category.deleted_at is null
          and lower(trim(category.name)) = v_category_key
        order by category.position, category.created_at
        limit 1;

      if not found then
        select coalesce(max(category.position), -1) + 1
          into v_position
          from public.menu_categories category
          where category.restaurant_id = p_restaurant_id
            and category.parent_id is null
            and category.deleted_at is null;

        insert into public.menu_categories (
          restaurant_id, name, position, is_visible, vat_rate
        ) values (
          p_restaurant_id, trim(v_row ->> 'category'), v_position, true, 10
        ) returning * into v_category;
        v_categories := v_categories || jsonb_build_array(to_jsonb(v_category));
      end if;

      if exists (
        select 1
        from public.menu_items item
        where item.category_id = v_category.id
          and item.deleted_at is null
          and lower(trim(item.name)) = v_product_key
      ) then
        v_failures := v_failures || jsonb_build_array(jsonb_build_object(
          'row', (v_row ->> 'sourceRow')::integer,
          'category', v_row ->> 'category',
          'name', v_row ->> 'name',
          'error', 'Ürün zaten mevcut.'
        ));
        continue;
      end if;

      select coalesce(max(item.position), -1) + 1
        into v_position
        from public.menu_items item
        where item.category_id = v_category.id
          and item.deleted_at is null;

      insert into public.menu_items (
        category_id,
        name,
        description,
        price,
        is_available,
        position,
        ingredients,
        energy_kcal,
        may_contain_allergens,
        contains_alcohol,
        contains_pork
      ) values (
        v_category.id,
        trim(v_row ->> 'name'),
        nullif(trim(v_row ->> 'description'), ''),
        (v_row ->> 'price')::numeric,
        true,
        v_position,
        coalesce(v_row -> 'ingredients', '[]'::jsonb),
        nullif(v_row ->> 'energyKcal', '')::integer,
        coalesce(array(select jsonb_array_elements_text(v_row -> 'mayContainAllergens')), '{}'::text[]),
        coalesce((v_row ->> 'containsAlcohol')::boolean, false),
        coalesce((v_row ->> 'containsPork')::boolean, false)
      ) returning * into v_item;
      v_items := v_items || jsonb_build_array(to_jsonb(v_item));
    exception
      when others then
        v_failures := v_failures || jsonb_build_array(jsonb_build_object(
          'row', coalesce((v_row ->> 'sourceRow')::integer, 0),
          'category', coalesce(v_row ->> 'category', ''),
          'name', coalesce(v_row ->> 'name', ''),
          'error', 'Satır işlenemedi.'
        ));
    end;
  end loop;

  return jsonb_build_object(
    'categories', v_categories,
    'items', v_items,
    'failures', v_failures
  );
end;
$$;

revoke all on function public.import_menu_rows(uuid, jsonb) from public, anon;
grant execute on function public.import_menu_rows(uuid, jsonb) to authenticated;
