-- Product-specific, manually ordered "goes well with" recommendations.
-- Public readers may only see relations whose source and target products are
-- currently available; all writes go through the tenant-scoped replacement RPC.

create table public.menu_item_recommendations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  source_item_id uuid not null references public.menu_items(id) on delete cascade,
  recommended_item_id uuid not null references public.menu_items(id) on delete cascade,
  position smallint not null,
  created_at timestamptz not null default now(),
  constraint menu_item_recommendations_not_self check (source_item_id <> recommended_item_id),
  constraint menu_item_recommendations_position check (position between 0 and 9),
  constraint menu_item_recommendations_pair_unique unique (source_item_id, recommended_item_id),
  constraint menu_item_recommendations_position_unique unique (source_item_id, position)
);

create index menu_item_recommendations_restaurant_idx
  on public.menu_item_recommendations (restaurant_id, source_item_id, position);

create or replace function public.validate_menu_item_recommendation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_source_restaurant uuid;
  v_target_restaurant uuid;
  v_count integer;
begin
  select category.restaurant_id into v_source_restaurant
  from public.menu_items item
  join public.menu_categories category on category.id = item.category_id
  where item.id = new.source_item_id and item.deleted_at is null and category.deleted_at is null;

  select category.restaurant_id into v_target_restaurant
  from public.menu_items item
  join public.menu_categories category on category.id = item.category_id
  where item.id = new.recommended_item_id and item.deleted_at is null and category.deleted_at is null;

  if v_source_restaurant is null or v_target_restaurant is null
    or v_source_restaurant <> new.restaurant_id
    or v_target_restaurant <> new.restaurant_id then
    raise exception 'recommendation items must belong to the same restaurant' using errcode = '23514';
  end if;

  select count(*) into v_count
  from public.menu_item_recommendations recommendation
  where recommendation.source_item_id = new.source_item_id
    and recommendation.id <> new.id;
  if v_count >= 10 then
    raise exception 'a product can have at most 10 recommendations' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger menu_item_recommendations_validate
before insert or update on public.menu_item_recommendations
for each row execute function public.validate_menu_item_recommendation();

revoke all on function public.validate_menu_item_recommendation() from public, anon, authenticated;

alter table public.menu_item_recommendations enable row level security;

create policy menu_item_recommendations_public_read
on public.menu_item_recommendations for select
to anon, authenticated
using (
  exists (
    select 1
    from public.menu_items source_item
    join public.menu_categories source_category on source_category.id = source_item.category_id
    join public.menu_items target_item on target_item.id = menu_item_recommendations.recommended_item_id
    join public.menu_categories target_category on target_category.id = target_item.category_id
    where source_item.id = menu_item_recommendations.source_item_id
      and source_category.restaurant_id = menu_item_recommendations.restaurant_id
      and target_category.restaurant_id = menu_item_recommendations.restaurant_id
      and source_item.is_available = true
      and target_item.is_available = true
      and source_item.deleted_at is null
      and target_item.deleted_at is null
      and source_category.deleted_at is null
      and target_category.deleted_at is null
  )
);

revoke all on public.menu_item_recommendations from public, anon, authenticated;
grant select (source_item_id, recommended_item_id, position)
  on public.menu_item_recommendations to anon, authenticated;

create or replace function public.replace_menu_item_recommendations(
  p_restaurant_id uuid,
  p_source_item_id uuid,
  p_recommended_item_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_expected integer := coalesce(array_length(p_recommended_item_ids, 1), 0);
  v_matched integer;
begin
  if not public.has_restaurant_section(p_restaurant_id, 'menu') then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if v_expected > 10 then
    raise exception 'a product can have at most 10 recommendations' using errcode = '22023';
  end if;
  if p_source_item_id = any(coalesce(p_recommended_item_ids, array[]::uuid[])) then
    raise exception 'a product cannot recommend itself' using errcode = '22023';
  end if;
  if (select count(distinct id) from unnest(coalesce(p_recommended_item_ids, array[]::uuid[])) ids(id)) <> v_expected then
    raise exception 'recommendation ids must be unique' using errcode = '22023';
  end if;

  perform 1
  from public.menu_items item
  join public.menu_categories category on category.id = item.category_id
  where item.id = p_source_item_id
    and item.deleted_at is null
    and category.deleted_at is null
    and category.restaurant_id = p_restaurant_id
  for update of item;
  if not found then
    raise exception 'source product not found' using errcode = 'P0002';
  end if;

  select count(*) into v_matched
  from public.menu_items item
  join public.menu_categories category on category.id = item.category_id
  where item.id = any(coalesce(p_recommended_item_ids, array[]::uuid[]))
    and item.deleted_at is null
    and category.deleted_at is null
    and category.restaurant_id = p_restaurant_id;
  if v_matched <> v_expected then
    raise exception 'invalid recommendation selection' using errcode = '22023';
  end if;

  delete from public.menu_item_recommendations
  where restaurant_id = p_restaurant_id and source_item_id = p_source_item_id;

  insert into public.menu_item_recommendations (
    restaurant_id, source_item_id, recommended_item_id, position
  )
  select p_restaurant_id, p_source_item_id, ordered.item_id, ordered.position - 1
  from unnest(coalesce(p_recommended_item_ids, array[]::uuid[]))
    with ordinality as ordered(item_id, position);
end;
$$;

revoke all on function public.replace_menu_item_recommendations(uuid, uuid, uuid[]) from public, anon;
grant execute on function public.replace_menu_item_recommendations(uuid, uuid, uuid[]) to authenticated;

comment on table public.menu_item_recommendations is
  'Tenant-scoped, manually ordered product recommendations used by the public product detail upsell.';
