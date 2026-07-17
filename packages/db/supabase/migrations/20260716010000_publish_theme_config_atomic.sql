-- Theme publish is one business operation. Persisting the tokens first and the
-- active template second could previously leave the live menu half-published.

alter table public.theme_configs
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

create or replace function public.publish_theme_config_atomic(
  p_restaurant_id uuid,
  p_template_id text,
  p_tokens jsonb,
  p_published_by uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slug text;
begin
  if coalesce(nullif(btrim(p_template_id), ''), '') = '' then
    raise exception 'template_id_required' using errcode = '22023';
  end if;
  if jsonb_typeof(p_tokens) is distinct from 'object' then
    raise exception 'theme_tokens_must_be_object' using errcode = '22023';
  end if;
  if p_tokens ->> '__template_id' is distinct from p_template_id then
    raise exception 'theme_template_mismatch' using errcode = '22023';
  end if;
  if p_published_by is null then
    raise exception 'publisher_required' using errcode = '22023';
  end if;

  update public.restaurants
  set settings = coalesce(settings, '{}'::jsonb)
      || jsonb_build_object('active_template_id', p_template_id),
      updated_at = now()
  where id = p_restaurant_id
    and deleted_at is null
  returning slug into v_slug;

  if v_slug is null then
    raise exception 'restaurant_not_found' using errcode = 'P0002';
  end if;

  insert into public.theme_configs (
    restaurant_id,
    tokens,
    updated_by,
    updated_at
  ) values (
    p_restaurant_id,
    p_tokens,
    p_published_by,
    now()
  )
  on conflict (restaurant_id) do update
  set tokens = excluded.tokens,
      updated_by = excluded.updated_by,
      updated_at = now();

  return v_slug;
end;
$$;

revoke all on function public.publish_theme_config_atomic(uuid, text, jsonb, uuid)
  from public, anon, authenticated;
grant execute on function public.publish_theme_config_atomic(uuid, text, jsonb, uuid)
  to service_role;
