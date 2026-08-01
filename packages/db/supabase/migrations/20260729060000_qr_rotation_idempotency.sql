-- A rotation request is a command, not a retryable "generate another token"
-- endpoint. Persist its identity so a lost response can be replayed safely.
alter table public.table_qr_tokens
  add column if not exists rotation_request_id uuid,
  add column if not exists rotation_requested_by uuid references auth.users(id) on delete set null,
  add column if not exists rotation_request_reason text;

create unique index if not exists table_qr_tokens_rotation_request_key
  on public.table_qr_tokens(rotation_request_id)
  where rotation_request_id is not null;

drop function if exists public.rotate_table_qr_token(uuid, uuid, uuid, text);

create or replace function public.rotate_table_qr_token(
  p_restaurant_id uuid,
  p_table_id uuid,
  p_request_id uuid,
  p_revoked_by uuid default null,
  p_reason text default 'rotated'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.table_qr_tokens%rowtype;
  v_reason text := coalesce(nullif(trim(p_reason), ''), 'rotated');
  v_token uuid;
begin
  if p_request_id is null then
    raise exception using errcode = '22023', message = 'qr_rotation_request_id_required';
  end if;

  -- Serialize equal request IDs even when a malformed retry changes table or
  -- tenant. This closes the check/insert race before the unique index fires.
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));

  select * into v_existing
  from public.table_qr_tokens
  where rotation_request_id = p_request_id;

  if found then
    if v_existing.restaurant_id <> p_restaurant_id
      or v_existing.table_id <> p_table_id
      or v_existing.rotation_requested_by is distinct from p_revoked_by
      or v_existing.rotation_request_reason is distinct from v_reason then
      raise exception using errcode = '22023', message = 'qr_rotation_request_conflict';
    end if;
    if v_existing.revoked_at is not null then
      raise exception using errcode = '55000', message = 'qr_rotation_request_is_stale';
    end if;
    return v_existing.token;
  end if;

  perform 1
  from public.tables
  where id = p_table_id
    and restaurant_id = p_restaurant_id
    and deleted_at is null
  for update;

  if not found then
    return null;
  end if;

  update public.table_qr_tokens
  set revoked_at = now(),
      revoked_by = p_revoked_by,
      revoke_reason = v_reason
  where table_id = p_table_id
    and revoked_at is null;

  insert into public.table_qr_tokens (
    restaurant_id,
    table_id,
    rotation_request_id,
    rotation_requested_by,
    rotation_request_reason
  ) values (
    p_restaurant_id,
    p_table_id,
    p_request_id,
    p_revoked_by,
    v_reason
  )
  returning token into v_token;

  return v_token;
end;
$$;

revoke all on function public.rotate_table_qr_token(uuid, uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.rotate_table_qr_token(uuid, uuid, uuid, uuid, text) to service_role;
