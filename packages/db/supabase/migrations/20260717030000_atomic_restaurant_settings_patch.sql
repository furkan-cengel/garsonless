-- Settings writes merge only the supplied top-level keys. This prevents a
-- settings screen from overwriting theme, QR, loyalty or notification changes
-- committed concurrently by another screen.

create or replace function public.patch_restaurant_settings_atomic(
  p_restaurant_id uuid,
  p_patch jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_updated boolean := false;
begin
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'settings patch must be a JSON object';
  end if;

  update public.restaurants
  set settings = coalesce(settings, '{}'::jsonb) || p_patch,
      updated_at = clock_timestamp()
  where id = p_restaurant_id
    and deleted_at is null;

  v_updated := found;
  return v_updated;
end;
$$;

revoke all on function public.patch_restaurant_settings_atomic(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.patch_restaurant_settings_atomic(uuid, jsonb)
  to service_role;
