-- Patch only settings.qr_style in one UPDATE. The previous read/merge/write
-- sequence could lose concurrent settings changes made by Theme or Settings.
create or replace function public.patch_restaurant_qr_style(
  p_restaurant_id uuid,
  p_qr_style jsonb
)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.restaurants
  set settings = jsonb_set(coalesce(settings, '{}'::jsonb), '{qr_style}', p_qr_style, true),
      updated_at = now()
  where id = p_restaurant_id
    and deleted_at is null;
$$;

revoke all on function public.patch_restaurant_qr_style(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.patch_restaurant_qr_style(uuid, jsonb) to service_role;
