-- 3D / AR for menu items (work package 2).
--
-- * GLB and USDZ files go through the existing media library: staged upload,
--   server validation, quota and cleanup. They skip image processing; the
--   private source and one public "model" object are stored per asset.
-- * A menu item has at most one draft and one published model version. Saving
--   a draft never changes what guests see; publishing does, and so does the
--   per-restaurant AR access switch. Both bump menu_invalidations, so the
--   public menu cache follows without a dashboard-only revalidation.
-- * Everything here is service-role-only; the dashboard calls it after its own
--   menu-permission check, the menu app reads the published projection.

-- 1. Media pipeline accepts model files (up to 10 MB) next to images and video.
update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array(
      select distinct unnest(coalesce(allowed_mime_types, '{}') || array['model/gltf-binary', 'model/vnd.usdz+zip'])
    )
where id in ('restaurant-media-staging', 'restaurant-media-sources');

do $migration$
declare
  fn regprocedure := 'public.media_command_core(uuid,uuid,text,text,jsonb)'::regprocedure;
  definition text;
  old_check text := E'n not between 1 and 8388608 or p_payload->>\'type\' not in (\'image/jpeg\',\'image/png\',\'image/webp\',\'image/avif\',\'video/mp4\',\'video/webm\')';
  new_check text := E'n not between 1 and (case when p_payload->>\'type\' like \'model/%\' then 10485760 else 8388608 end) or p_payload->>\'type\' not in (\'image/jpeg\',\'image/png\',\'image/webp\',\'image/avif\',\'video/mp4\',\'video/webm\',\'model/gltf-binary\',\'model/vnd.usdz+zip\')';
  old_reserve text := E'n:=n+case when p_payload->>\'type\' like \'video/%\' then n else 15728640 end;';
  new_reserve text := E'n:=n+case when p_payload->>\'type\' like \'video/%\' or p_payload->>\'type\' like \'model/%\' then n else 15728640 end;';
begin
  select pg_get_functiondef(fn) into definition;
  if position(new_check in definition) > 0 then
    return;
  end if;
  if position(old_check in definition) = 0 or position(old_reserve in definition) = 0 then
    raise exception 'media_command_core upload limits have unexpected shape';
  end if;
  definition := replace(definition, old_check, new_check);
  definition := replace(definition, old_reserve, new_reserve);
  execute definition;
end
$migration$;

-- 2. Per-restaurant AR access (not tied to billing plans). Closed by default.
create table public.restaurant_ar_access (
  restaurant_id uuid primary key references public.restaurants(id) on delete cascade,
  enabled boolean not null default false,
  note text check (note is null or char_length(note) <= 500),
  updated_at timestamptz not null default now()
);

-- 3. Model versions and the per-item draft/published pointer.
create table public.menu_item_ar_versions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  menu_item_id uuid not null references public.menu_items(id) on delete cascade,
  glb_asset_id uuid not null,
  usdz_asset_id uuid,
  poster_url text check (poster_url is null or char_length(poster_url) <= 2000),
  width_mm integer check (width_mm is null or width_mm between 10 and 1000),
  depth_mm integer check (depth_mm is null or depth_mm between 10 and 1000),
  height_mm integer check (height_mm is null or height_mm between 5 and 1000),
  portion_note text check (portion_note is null or char_length(portion_note) <= 120),
  published_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  foreign key (restaurant_id, glb_asset_id) references public.media_assets(restaurant_id, id),
  foreign key (restaurant_id, usdz_asset_id) references public.media_assets(restaurant_id, id)
);
create index menu_item_ar_versions_item on public.menu_item_ar_versions(restaurant_id, menu_item_id, created_at desc);

create table public.menu_item_ar (
  menu_item_id uuid primary key references public.menu_items(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  draft_version_id uuid references public.menu_item_ar_versions(id) on delete set null,
  published_version_id uuid references public.menu_item_ar_versions(id) on delete set null,
  updated_at timestamptz not null default now()
);
create index menu_item_ar_restaurant on public.menu_item_ar(restaurant_id);

alter table public.restaurant_ar_access enable row level security;
alter table public.menu_item_ar_versions enable row level security;
alter table public.menu_item_ar enable row level security;
revoke all on public.restaurant_ar_access, public.menu_item_ar_versions, public.menu_item_ar from public, anon, authenticated;
grant select, insert, update, delete on public.restaurant_ar_access, public.menu_item_ar_versions, public.menu_item_ar to service_role;

-- 4. Publishing, unpublishing and the access switch move the public menu revision.
drop trigger if exists menu_invalidate_after_change on public.menu_item_ar;
create trigger menu_invalidate_after_change after insert or update or delete on public.menu_item_ar
  for each row execute function public.bump_menu_invalidation();
drop trigger if exists menu_invalidate_after_change on public.restaurant_ar_access;
create trigger menu_invalidate_after_change after insert or update or delete on public.restaurant_ar_access
  for each row execute function public.bump_menu_invalidation();

-- Model object URL of a ready asset in this restaurant with the expected type.
create or replace function public.menu_ar_model_url(p_restaurant uuid, p_asset uuid, p_mime text)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select o.url
  from public.media_assets a
  join public.media_asset_objects o on o.asset_id = a.id and o.role = 'model'
  where a.id = p_asset and a.restaurant_id = p_restaurant and a.status = 'ready' and a.mime = p_mime and o.url <> ''
$$;

-- Drop versions that are neither the draft nor the published one, with their media references.
create or replace function public.menu_ar_prune_versions(p_restaurant uuid, p_item uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_keep uuid[];
begin
  select array_remove(array[draft_version_id, published_version_id], null) into v_keep
  from public.menu_item_ar where menu_item_id = p_item and restaurant_id = p_restaurant;
  delete from public.media_asset_references r
  using public.menu_item_ar_versions v
  where r.restaurant_id = p_restaurant and r.target_table = 'menu_item_ar_versions' and r.target_id = v.id::text
    and v.restaurant_id = p_restaurant and v.menu_item_id = p_item and not (v.id = any(coalesce(v_keep, '{}')));
  delete from public.menu_item_ar_versions v
  where v.restaurant_id = p_restaurant and v.menu_item_id = p_item and not (v.id = any(coalesce(v_keep, '{}')));
end;
$$;

create or replace function public.save_menu_item_ar_draft(
  p_restaurant uuid,
  p_actor uuid,
  p_item uuid,
  p_glb_asset uuid,
  p_usdz_asset uuid,
  p_poster_url text,
  p_width_mm integer,
  p_depth_mm integer,
  p_height_mm integer,
  p_portion_note text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item_name text;
  v_version uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('menu_ar:' || p_item::text, 0));

  select i.name into v_item_name
  from public.menu_items i
  join public.menu_categories c on c.id = i.category_id
  where i.id = p_item and c.restaurant_id = p_restaurant and i.deleted_at is null and c.deleted_at is null;
  if v_item_name is null then
    raise exception 'menu_ar_invalid_item' using errcode = '22023';
  end if;
  if public.menu_ar_model_url(p_restaurant, p_glb_asset, 'model/gltf-binary') is null then
    raise exception 'menu_ar_invalid_glb' using errcode = '22023';
  end if;
  if p_usdz_asset is not null and public.menu_ar_model_url(p_restaurant, p_usdz_asset, 'model/vnd.usdz+zip') is null then
    raise exception 'menu_ar_invalid_usdz' using errcode = '22023';
  end if;
  if p_poster_url is not null
    and p_poster_url not like '%/storage/v1/object/public/restaurant-assets/restaurants/' || p_restaurant::text || '/%' then
    raise exception 'menu_ar_invalid_poster' using errcode = '22023';
  end if;

  insert into public.menu_item_ar_versions(
    restaurant_id, menu_item_id, glb_asset_id, usdz_asset_id, poster_url,
    width_mm, depth_mm, height_mm, portion_note, created_by
  )
  values (
    p_restaurant, p_item, p_glb_asset, p_usdz_asset, nullif(btrim(coalesce(p_poster_url, '')), ''),
    p_width_mm, p_depth_mm, p_height_mm, nullif(btrim(coalesce(p_portion_note, '')), ''), p_actor
  )
  returning id into v_version;

  insert into public.media_asset_references(restaurant_id, asset_id, target_table, target_id, label)
  select p_restaurant, asset_id, 'menu_item_ar_versions', v_version::text, left(v_item_name || ' · 3D model', 200)
  from unnest(array_remove(array[p_glb_asset, p_usdz_asset], null)) as asset_id
  on conflict do nothing;

  insert into public.menu_item_ar(menu_item_id, restaurant_id, draft_version_id, updated_at)
  values (p_item, p_restaurant, v_version, now())
  on conflict (menu_item_id) do update
    set draft_version_id = excluded.draft_version_id, updated_at = excluded.updated_at
    where public.menu_item_ar.restaurant_id = p_restaurant;

  perform public.menu_ar_prune_versions(p_restaurant, p_item);
  return v_version;
end;
$$;

create or replace function public.publish_menu_item_ar(p_restaurant uuid, p_item uuid, p_version uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('menu_ar:' || p_item::text, 0));
  if not exists (
    select 1 from public.menu_item_ar_versions v
    join public.menu_items i on i.id = v.menu_item_id and i.deleted_at is null
    where v.id = p_version and v.menu_item_id = p_item and v.restaurant_id = p_restaurant
      and public.menu_ar_model_url(p_restaurant, v.glb_asset_id, 'model/gltf-binary') is not null
  ) then
    raise exception 'menu_ar_invalid_version' using errcode = '22023';
  end if;
  update public.menu_item_ar_versions set published_at = coalesce(published_at, now()) where id = p_version;
  update public.menu_item_ar
    set published_version_id = p_version, updated_at = now()
    where menu_item_id = p_item and restaurant_id = p_restaurant;
  if not found then
    raise exception 'menu_ar_invalid_version' using errcode = '22023';
  end if;
  perform public.menu_ar_prune_versions(p_restaurant, p_item);
end;
$$;

create or replace function public.unpublish_menu_item_ar(p_restaurant uuid, p_item uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('menu_ar:' || p_item::text, 0));
  update public.menu_item_ar
    set published_version_id = null, updated_at = now()
    where menu_item_id = p_item and restaurant_id = p_restaurant and published_version_id is not null;
  perform public.menu_ar_prune_versions(p_restaurant, p_item);
end;
$$;

-- Dashboard read: draft and published versions with their model URLs.
create or replace function public.read_menu_item_ar(p_restaurant uuid, p_item uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'accessEnabled', coalesce((select enabled from public.restaurant_ar_access where restaurant_id = p_restaurant), false),
    'draft', (select to_jsonb(v) || jsonb_build_object(
        'glbUrl', public.menu_ar_model_url(p_restaurant, v.glb_asset_id, 'model/gltf-binary'),
        'usdzUrl', public.menu_ar_model_url(p_restaurant, v.usdz_asset_id, 'model/vnd.usdz+zip'))
      from public.menu_item_ar a join public.menu_item_ar_versions v on v.id = a.draft_version_id
      where a.menu_item_id = p_item and a.restaurant_id = p_restaurant),
    'publishedVersionId', (select published_version_id from public.menu_item_ar where menu_item_id = p_item and restaurant_id = p_restaurant)
  )
$$;

-- Public menu read: only published models, only when AR access is on.
create or replace function public.read_published_menu_ar(p_restaurant uuid)
returns table (
  menu_item_id uuid,
  glb_url text,
  usdz_url text,
  poster_url text,
  width_mm integer,
  depth_mm integer,
  height_mm integer,
  portion_note text,
  version_id uuid
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select a.menu_item_id,
         public.menu_ar_model_url(p_restaurant, v.glb_asset_id, 'model/gltf-binary'),
         public.menu_ar_model_url(p_restaurant, v.usdz_asset_id, 'model/vnd.usdz+zip'),
         v.poster_url, v.width_mm, v.depth_mm, v.height_mm, v.portion_note, v.id
  from public.menu_item_ar a
  join public.menu_item_ar_versions v on v.id = a.published_version_id
  join public.menu_items i on i.id = a.menu_item_id and i.deleted_at is null
  where a.restaurant_id = p_restaurant
    and exists (select 1 from public.restaurant_ar_access x where x.restaurant_id = p_restaurant and x.enabled)
    and public.menu_ar_model_url(p_restaurant, v.glb_asset_id, 'model/gltf-binary') is not null
$$;

revoke all on function public.menu_ar_model_url(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.menu_ar_prune_versions(uuid, uuid) from public, anon, authenticated;
revoke all on function public.save_menu_item_ar_draft(uuid, uuid, uuid, uuid, uuid, text, integer, integer, integer, text) from public, anon, authenticated;
revoke all on function public.publish_menu_item_ar(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.unpublish_menu_item_ar(uuid, uuid) from public, anon, authenticated;
revoke all on function public.read_menu_item_ar(uuid, uuid) from public, anon, authenticated;
revoke all on function public.read_published_menu_ar(uuid) from public, anon, authenticated;
grant execute on function public.save_menu_item_ar_draft(uuid, uuid, uuid, uuid, uuid, text, integer, integer, integer, text) to service_role;
grant execute on function public.publish_menu_item_ar(uuid, uuid, uuid) to service_role;
grant execute on function public.unpublish_menu_item_ar(uuid, uuid) to service_role;
grant execute on function public.read_menu_item_ar(uuid, uuid) to service_role;
grant execute on function public.read_published_menu_ar(uuid) to service_role;
