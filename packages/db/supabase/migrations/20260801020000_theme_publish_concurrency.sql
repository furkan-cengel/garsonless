-- Theme publish is a compare-and-swap command. A restaurant row serializes
-- first publish and later updates, while the theme row carries the canonical
-- revision. Durable request records make lost-response retries exact and
-- immutable history rows preserve every published rollback point.

alter table public.theme_configs
  add column if not exists revision bigint,
  add column if not exists published_at timestamptz;

update public.theme_configs
set revision = coalesce(revision, 1),
    published_at = coalesce(published_at, updated_at, clock_timestamp())
where revision is null or published_at is null;

alter table public.theme_configs
  alter column revision set default 1,
  alter column revision set not null,
  alter column published_at set not null,
  add constraint theme_configs_revision_nonnegative check (revision >= 0);

create table public.theme_publish_operations (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  request_id uuid not null,
  request_fingerprint text not null check (request_fingerprint ~ '^[a-f0-9]{64}$'),
  expected_revision bigint not null check (expected_revision >= 0),
  template_id text not null,
  tokens jsonb not null check (jsonb_typeof(tokens) = 'object'),
  published_by uuid not null references auth.users(id) on delete restrict,
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  created_at timestamptz not null default clock_timestamp(),
  primary key (restaurant_id, request_id)
);

create table public.theme_config_history (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  revision bigint not null check (revision > 0),
  template_id text not null,
  tokens jsonb not null check (jsonb_typeof(tokens) = 'object'),
  published_by uuid references auth.users(id) on delete set null,
  published_at timestamptz not null,
  request_id uuid,
  request_fingerprint text check (request_fingerprint is null or request_fingerprint ~ '^[a-f0-9]{64}$'),
  unique (restaurant_id, revision),
  unique (restaurant_id, request_id)
);

insert into public.theme_config_history (
  restaurant_id,
  revision,
  template_id,
  tokens,
  published_by,
  published_at
)
select
  restaurant_id,
  revision,
  coalesce(nullif(tokens ->> '__template_id', ''), 'default'),
  tokens,
  updated_by,
  published_at
from public.theme_configs
on conflict (restaurant_id, revision) do nothing;

alter table public.theme_publish_operations enable row level security;
alter table public.theme_config_history enable row level security;

revoke all on table public.theme_configs from public, anon, authenticated;
revoke all on table public.theme_publish_operations from public, anon, authenticated;
revoke all on table public.theme_config_history from public, anon, authenticated;
grant select on table public.theme_configs to service_role;
grant select on table public.theme_publish_operations to service_role;
grant select on table public.theme_config_history to service_role;

drop function if exists public.publish_theme_config_atomic(uuid, text, jsonb, uuid);

create function public.publish_theme_config_atomic(
  p_restaurant_id uuid,
  p_template_id text,
  p_tokens jsonb,
  p_published_by uuid,
  p_expected_revision bigint,
  p_request_id uuid,
  p_request_fingerprint text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_slug text;
  v_owner_id uuid;
  v_has_config boolean := false;
  v_current_revision bigint := 0;
  v_current_tokens jsonb := '{}'::jsonb;
  v_current_published_at timestamptz;
  v_operation public.theme_publish_operations%rowtype;
  v_next_revision bigint;
  v_now timestamptz;
  v_result jsonb;
begin
  if p_restaurant_id is null or p_published_by is null or p_request_id is null then
    raise exception 'theme_publish_identity_required' using errcode = '22023';
  end if;
  if coalesce(nullif(btrim(p_template_id), ''), '') = '' then
    raise exception 'template_id_required' using errcode = '22023';
  end if;
  if p_template_id <> 'default' then
    raise exception 'theme_template_unknown' using errcode = '22023';
  end if;
  if p_tokens is null or jsonb_typeof(p_tokens) <> 'object' then
    raise exception 'theme_tokens_must_be_object' using errcode = '22023';
  end if;
  if octet_length(p_tokens::text) > 262144 then
    raise exception 'theme_tokens_too_large' using errcode = '22023';
  end if;
  if p_tokens ->> '__template_id' is distinct from p_template_id then
    raise exception 'theme_template_mismatch' using errcode = '22023';
  end if;
  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'theme_expected_revision_invalid' using errcode = '22023';
  end if;
  if p_request_fingerprint is null or p_request_fingerprint !~ '^[a-f0-9]{64}$' then
    raise exception 'theme_request_fingerprint_invalid' using errcode = '22023';
  end if;

  -- This lock serializes initial publishes even before a theme_config row exists.
  select slug, owner_id
  into v_slug, v_owner_id
  from public.restaurants
  where id = p_restaurant_id and deleted_at is null
  for update;

  if not found then
    raise exception 'restaurant_not_found' using errcode = 'P0002';
  end if;

  if v_owner_id <> p_published_by and not exists (
    select 1
    from public.restaurant_members member
    where member.restaurant_id = p_restaurant_id
      and member.user_id = p_published_by
      and member.status = 'active'
      and member.permissions ? 'theme'
  ) then
    raise exception 'theme_publisher_not_authorized' using errcode = '42501';
  end if;

  select *
  into v_operation
  from public.theme_publish_operations
  where restaurant_id = p_restaurant_id and request_id = p_request_id;

  if found then
    if v_operation.request_fingerprint <> p_request_fingerprint
       or v_operation.expected_revision <> p_expected_revision
       or v_operation.template_id <> p_template_id
       or v_operation.tokens <> p_tokens
       or v_operation.published_by <> p_published_by then
      raise exception 'theme_publish_idempotency_conflict' using errcode = 'P0001';
    end if;
    if v_operation.result ->> 'status' = 'published' then
      return jsonb_set(v_operation.result, '{status}', to_jsonb('replayed'::text), true);
    end if;
    return v_operation.result;
  end if;

  select revision, tokens, published_at
  into v_current_revision, v_current_tokens, v_current_published_at
  from public.theme_configs
  where restaurant_id = p_restaurant_id
  for update;
  v_has_config := found;

  if not v_has_config then
    v_current_revision := 0;
    v_current_tokens := '{}'::jsonb;
    v_current_published_at := null;
  end if;

  if v_current_revision <> p_expected_revision then
    v_result := jsonb_build_object(
      'status', 'conflict',
      'snapshot', jsonb_build_object(
        'revision', v_current_revision,
        'templateId', coalesce(nullif(v_current_tokens ->> '__template_id', ''), 'default'),
        'tokens', v_current_tokens,
        'publishedAt', v_current_published_at
      )
    );

    insert into public.theme_publish_operations (
      restaurant_id, request_id, request_fingerprint, expected_revision,
      template_id, tokens, published_by, result
    ) values (
      p_restaurant_id, p_request_id, p_request_fingerprint, p_expected_revision,
      p_template_id, p_tokens, p_published_by, v_result
    );
    return v_result;
  end if;

  v_next_revision := v_current_revision + 1;
  v_now := clock_timestamp();

  insert into public.theme_configs (
    restaurant_id, tokens, updated_by, updated_at, revision, published_at
  ) values (
    p_restaurant_id, p_tokens, p_published_by, v_now, v_next_revision, v_now
  )
  on conflict (restaurant_id) do update
  set tokens = excluded.tokens,
      updated_by = excluded.updated_by,
      updated_at = excluded.updated_at,
      revision = excluded.revision,
      published_at = excluded.published_at;

  update public.restaurants
  set settings = coalesce(settings, '{}'::jsonb)
      || jsonb_build_object('active_template_id', p_template_id),
      updated_at = v_now
  where id = p_restaurant_id;

  insert into public.theme_config_history (
    restaurant_id, revision, template_id, tokens, published_by,
    published_at, request_id, request_fingerprint
  ) values (
    p_restaurant_id, v_next_revision, p_template_id, p_tokens, p_published_by,
    v_now, p_request_id, p_request_fingerprint
  );

  v_result := jsonb_build_object(
    'status', 'published',
    'revision', v_next_revision,
    'publishedAt', v_now,
    'slug', v_slug
  );

  insert into public.theme_publish_operations (
    restaurant_id, request_id, request_fingerprint, expected_revision,
    template_id, tokens, published_by, result
  ) values (
    p_restaurant_id, p_request_id, p_request_fingerprint, p_expected_revision,
    p_template_id, p_tokens, p_published_by, v_result
  );

  return v_result;
end;
$$;

revoke all on function public.publish_theme_config_atomic(uuid, text, jsonb, uuid, bigint, uuid, text)
  from public, anon, authenticated;
grant execute on function public.publish_theme_config_atomic(uuid, text, jsonb, uuid, bigint, uuid, text)
  to service_role;

comment on function public.publish_theme_config_atomic(uuid, text, jsonb, uuid, bigint, uuid, text)
  is 'Revisioned and idempotent canonical theme publish; service-role only.';
