alter table public.restaurants
  add column if not exists qr_style_revision bigint not null default 0;

alter table public.restaurants
  drop constraint if exists restaurants_qr_style_revision_nonnegative;

alter table public.restaurants
  add constraint restaurants_qr_style_revision_nonnegative
  check (qr_style_revision >= 0);

drop function if exists public.patch_restaurant_qr_style(uuid, jsonb);

create or replace function public.patch_restaurant_qr_style(
  p_restaurant_id uuid,
  p_qr_style jsonb,
  p_expected_revision bigint
)
returns table(outcome text, revision bigint, style jsonb)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_revision bigint;
  v_style jsonb;
begin
  if p_expected_revision < 0 then
    raise exception 'invalid_qr_style_revision' using errcode = '22023';
  end if;

  update public.restaurants as restaurant
  set settings = jsonb_set(coalesce(restaurant.settings, '{}'::jsonb), '{qr_style}', p_qr_style, true),
      qr_style_revision = restaurant.qr_style_revision + 1,
      updated_at = now()
  where restaurant.id = p_restaurant_id
    and restaurant.deleted_at is null
    and restaurant.qr_style_revision = p_expected_revision
  returning restaurant.qr_style_revision, restaurant.settings -> 'qr_style'
    into v_revision, v_style;

  if found then
    return query select 'saved'::text, v_revision, v_style;
    return;
  end if;

  select restaurant.qr_style_revision, restaurant.settings -> 'qr_style'
  into v_revision, v_style
  from public.restaurants as restaurant
  where restaurant.id = p_restaurant_id
    and restaurant.deleted_at is null;

  if not found then
    return query select 'not_found'::text, 0::bigint, null::jsonb;
    return;
  end if;

  return query select 'conflict'::text, v_revision, v_style;
end;
$$;

revoke all on function public.patch_restaurant_qr_style(uuid, jsonb, bigint) from public, anon, authenticated;
grant execute on function public.patch_restaurant_qr_style(uuid, jsonb, bigint) to service_role;

comment on function public.patch_restaurant_qr_style(uuid, jsonb, bigint) is
  'Atomically patches settings.qr_style when the expected revision matches; returns the authoritative snapshot on conflict.';
