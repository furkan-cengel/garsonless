-- Settings writes use per-top-level-key compare-and-swap semantics. Two
-- sections can save from the same page snapshot without conflicting, while a
-- stale save of the same section is rejected instead of silently overwriting.
-- A request id records the intent/result so ambiguous retries are idempotent.

create table if not exists public.restaurant_settings_patch_operations (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  request_id uuid not null,
  patch jsonb not null check (jsonb_typeof(patch) = 'object'),
  expected_states jsonb not null check (jsonb_typeof(expected_states) = 'object'),
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  created_at timestamptz not null default clock_timestamp(),
  primary key (restaurant_id, request_id)
);

alter table public.restaurant_settings_patch_operations enable row level security;
revoke all on table public.restaurant_settings_patch_operations from public, anon, authenticated;
grant select, insert on table public.restaurant_settings_patch_operations to service_role;

create or replace function public.patch_restaurant_settings_cas(
  p_restaurant_id uuid,
  p_patch jsonb,
  p_expected_settings jsonb,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_current jsonb;
  v_expected_states jsonb := '{}'::jsonb;
  v_current_projection jsonb := '{}'::jsonb;
  v_conflict_keys jsonb := '[]'::jsonb;
  v_desired_already_current boolean := true;
  v_key text;
  v_operation public.restaurant_settings_patch_operations%rowtype;
  v_result jsonb;
begin
  if p_restaurant_id is null or p_request_id is null then
    raise exception 'settings_patch_identity_required' using errcode = '22023';
  end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' or p_patch = '{}'::jsonb then
    raise exception 'settings_patch_must_be_non_empty_object' using errcode = '22023';
  end if;
  if p_expected_settings is null or jsonb_typeof(p_expected_settings) <> 'object' then
    raise exception 'settings_expected_snapshot_must_be_object' using errcode = '22023';
  end if;

  for v_key in select jsonb_object_keys(p_patch)
  loop
    v_expected_states := v_expected_states || jsonb_build_object(
      v_key,
      jsonb_build_object(
        'present', p_expected_settings ? v_key,
        'value', p_expected_settings -> v_key
      )
    );
  end loop;

  -- The restaurant row serializes all settings operations. Conflict checks are
  -- still per key, so unrelated section saves both succeed after waiting.
  select coalesce(settings, '{}'::jsonb)
  into v_current
  from public.restaurants
  where id = p_restaurant_id and deleted_at is null
  for update;

  if not found then
    return jsonb_build_object('outcome', 'not_found', 'idempotent', false, 'settings', '{}'::jsonb);
  end if;

  select * into v_operation
  from public.restaurant_settings_patch_operations
  where restaurant_id = p_restaurant_id and request_id = p_request_id;

  if found then
    if v_operation.patch <> p_patch or v_operation.expected_states <> v_expected_states then
      raise exception 'settings_patch_idempotency_conflict' using errcode = 'P0001';
    end if;
    return jsonb_set(v_operation.result, '{idempotent}', 'true'::jsonb, true);
  end if;

  for v_key in select jsonb_object_keys(p_patch)
  loop
    if v_current ? v_key then
      v_current_projection := v_current_projection || jsonb_build_object(v_key, v_current -> v_key);
    end if;
    if not (v_current ? v_key and (v_current -> v_key) is not distinct from (p_patch -> v_key)) then
      v_desired_already_current := false;
    end if;

    if (v_current ? v_key) <> (p_expected_settings ? v_key)
       or (v_current -> v_key) is distinct from (p_expected_settings -> v_key) then
      -- A retry with a fresh request id is still safe when the desired state is
      -- already canonical. This covers a committed response lost in transit.
      if not (v_current ? v_key and (v_current -> v_key) is not distinct from (p_patch -> v_key)) then
        v_conflict_keys := v_conflict_keys || to_jsonb(v_key);
      end if;
    end if;
  end loop;

  if jsonb_array_length(v_conflict_keys) > 0 then
    v_result := jsonb_build_object(
      'outcome', 'conflict',
      'idempotent', false,
      'settings', v_current_projection,
      'conflictKeys', v_conflict_keys
    );
  elsif v_desired_already_current then
    v_result := jsonb_build_object(
      'outcome', 'saved',
      'idempotent', true,
      'settings', v_current_projection,
      'conflictKeys', '[]'::jsonb
    );
  else
    v_current := v_current || p_patch;
    update public.restaurants
    set settings = v_current, updated_at = clock_timestamp()
    where id = p_restaurant_id;

    v_result := jsonb_build_object(
      'outcome', 'saved',
      'idempotent', false,
      'settings', p_patch,
      'conflictKeys', '[]'::jsonb
    );
  end if;

  insert into public.restaurant_settings_patch_operations (
    restaurant_id, request_id, patch, expected_states, result
  ) values (
    p_restaurant_id, p_request_id, p_patch, v_expected_states, v_result
  );

  return v_result;
end;
$$;

revoke all on function public.patch_restaurant_settings_cas(uuid, jsonb, jsonb, uuid)
  from public, anon, authenticated;
grant execute on function public.patch_restaurant_settings_cas(uuid, jsonb, jsonb, uuid)
  to service_role;

comment on function public.patch_restaurant_settings_cas(uuid, jsonb, jsonb, uuid)
  is 'Per-key CAS settings patch with durable request idempotency; service-role only.';
