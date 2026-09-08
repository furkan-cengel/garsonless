-- Temporary, private upload bookkeeping. Only server-side service role can access it.
create table if not exists public.dashboard_media_uploads (
  id uuid primary key,
  user_id uuid not null,
  restaurant_id uuid not null,
  kind text not null check (kind in ('menu-image', 'theme-image', 'theme-video')),
  metadata jsonb not null,
  path text not null unique,
  status text not null default 'pending' check (status in ('pending', 'processing', 'finished')),
  result jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '15 minutes'
);
alter table public.dashboard_media_uploads enable row level security;
revoke all on public.dashboard_media_uploads from anon, authenticated;
create index if not exists dashboard_media_uploads_age on public.dashboard_media_uploads(created_at);
create index if not exists dashboard_media_uploads_actor on public.dashboard_media_uploads(user_id, created_at);

create or replace function public.dashboard_media_staging(p_op text, p_input jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.dashboard_media_uploads; v_id uuid := (p_input->>'id')::uuid;
begin
  if p_op = 'create' then
    perform pg_advisory_xact_lock(hashtextextended('media:' || (p_input->>'userId'), 0));
    if (select count(*) from public.dashboard_media_uploads where user_id = (p_input->>'userId')::uuid and created_at > now() - interval '15 minutes') >= 20 then
      raise exception 'MEDIA_UPLOAD_RATE_LIMIT';
    end if;
    insert into public.dashboard_media_uploads(id, user_id, restaurant_id, kind, metadata, path)
    values (v_id, (p_input->>'userId')::uuid, (p_input->>'restaurantId')::uuid, p_input->>'kind', p_input->'metadata', p_input->>'path') returning * into r;
  elsif p_op = 'read' then
    select * into r from public.dashboard_media_uploads where id=v_id and user_id=(p_input->>'userId')::uuid;
  elsif p_op = 'claim' then
    update public.dashboard_media_uploads set status='processing'
    where id=v_id and user_id=(p_input->>'userId')::uuid and status='pending' and expires_at > now() returning * into r;
  elsif p_op = 'release' then
    update public.dashboard_media_uploads set status='pending'
    where id=v_id and user_id=(p_input->>'userId')::uuid and status='processing' returning * into r;
  elsif p_op = 'finish' then
    update public.dashboard_media_uploads set status='finished', result=p_input->'result'
    where id=v_id and user_id=(p_input->>'userId')::uuid and status='processing' returning * into r;
  elsif p_op = 'expired' then
    -- Signed storage upload URLs live for two hours. Retain rows/objects until
    -- after that window, so a consumed URL cannot recreate an untracked object.
    return coalesce((select jsonb_agg(to_jsonb(t)) from (
      select * from public.dashboard_media_uploads where created_at < now() - interval '3 hours' order by created_at limit 100
    ) t), '[]'::jsonb);
  elsif p_op = 'remove-many' then
    delete from public.dashboard_media_uploads
    where id in (select value::uuid from jsonb_array_elements_text(p_input->'ids')) and created_at < now() - interval '3 hours';
    return null;
  elsif p_op = 'remove' then
    delete from public.dashboard_media_uploads where id=v_id and created_at < now() - interval '3 hours' returning * into r;
  else raise exception 'Unknown media staging operation';
  end if;
  if r.id is null then return null; end if;
  return to_jsonb(r);
end;
$$;
revoke all on function public.dashboard_media_staging(text, jsonb) from public, anon, authenticated;
grant execute on function public.dashboard_media_staging(text, jsonb) to service_role;
