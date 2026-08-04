-- Persist editor drafts independently from the public theme. Both commands are
-- service-role only; restaurant membership and optimistic revisions are
-- revalidated while the restaurant row is locked.

create table public.theme_drafts (
  restaurant_id uuid primary key references public.restaurants(id) on delete cascade,
  template_id text not null,
  tokens jsonb not null check (jsonb_typeof(tokens) = 'object'),
  revision bigint not null default 1 check (revision > 0),
  based_on_published_revision bigint not null default 0 check (based_on_published_revision >= 0),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default clock_timestamp()
);

create table public.theme_draft_operations (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  request_id uuid not null,
  request_fingerprint text not null check (request_fingerprint ~ '^[a-f0-9]{64}$'),
  expected_revision bigint not null check (expected_revision >= 0),
  template_id text not null,
  tokens jsonb not null check (jsonb_typeof(tokens) = 'object'),
  saved_by uuid not null references auth.users(id) on delete restrict,
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  created_at timestamptz not null default clock_timestamp(),
  primary key (restaurant_id, request_id)
);

alter table public.theme_publish_operations
  add column if not exists draft_revision bigint check (draft_revision is null or draft_revision > 0);

alter table public.theme_drafts enable row level security;
alter table public.theme_draft_operations enable row level security;

revoke all on table public.theme_drafts from public, anon, authenticated;
revoke all on table public.theme_draft_operations from public, anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on table public.theme_drafts from service_role;
revoke insert, update, delete, truncate, references, trigger on table public.theme_draft_operations from service_role;
grant select on table public.theme_drafts to service_role;
grant select on table public.theme_draft_operations to service_role;

create function public.save_theme_draft_atomic(
  p_restaurant_id uuid,
  p_template_id text,
  p_tokens jsonb,
  p_saved_by uuid,
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
  v_owner_id uuid;
  v_operation public.theme_draft_operations%rowtype;
  v_current public.theme_drafts%rowtype;
  v_published_revision bigint := 0;
  v_published_tokens jsonb := '{}'::jsonb;
  v_next_revision bigint;
  v_now timestamptz;
  v_result jsonb;
begin
  if p_restaurant_id is null or p_saved_by is null or p_request_id is null then
    raise exception 'theme_draft_identity_required' using errcode = '22023';
  end if;
  if p_template_id <> 'default' then
    raise exception 'theme_template_unknown' using errcode = '22023';
  end if;
  if p_tokens is null or jsonb_typeof(p_tokens) <> 'object'
     or octet_length(p_tokens::text) > 262144
     or p_tokens ->> '__template_id' is distinct from p_template_id then
    raise exception 'theme_draft_tokens_invalid' using errcode = '22023';
  end if;
  if p_expected_revision is null or p_expected_revision < 0
     or p_request_fingerprint is null
     or p_request_fingerprint !~ '^[a-f0-9]{64}$' then
    raise exception 'theme_draft_request_invalid' using errcode = '22023';
  end if;

  select owner_id into v_owner_id
  from public.restaurants
  where id = p_restaurant_id and deleted_at is null
  for update;
  if not found then
    raise exception 'restaurant_not_found' using errcode = 'P0002';
  end if;
  if v_owner_id <> p_saved_by and not exists (
    select 1 from public.restaurant_members member
    where member.restaurant_id = p_restaurant_id
      and member.user_id = p_saved_by
      and member.status = 'active'
      and member.permissions ? 'theme'
  ) then
    raise exception 'theme_draft_writer_not_authorized' using errcode = '42501';
  end if;

  select * into v_operation from public.theme_draft_operations
  where restaurant_id = p_restaurant_id and request_id = p_request_id;
  if found then
    if v_operation.request_fingerprint <> p_request_fingerprint
       or v_operation.expected_revision <> p_expected_revision
       or v_operation.template_id <> p_template_id
       or v_operation.tokens <> p_tokens
       or v_operation.saved_by <> p_saved_by then
      raise exception 'theme_draft_idempotency_conflict' using errcode = 'P0001';
    end if;
    if v_operation.result ->> 'status' = 'saved' then
      return jsonb_set(v_operation.result, '{status}', to_jsonb('replayed'::text), true);
    end if;
    return v_operation.result;
  end if;

  select * into v_current from public.theme_drafts
  where restaurant_id = p_restaurant_id for update;
  if not found then v_current.revision := 0; end if;

  if v_current.revision <> p_expected_revision then
    v_result := jsonb_build_object(
      'status', 'conflict',
      'snapshot', case when v_current.revision = 0 then null else jsonb_build_object(
        'templateId', v_current.template_id,
        'tokens', v_current.tokens,
        'revision', v_current.revision,
        'basedOnPublishedRevision', v_current.based_on_published_revision,
        'savedAt', v_current.updated_at
      ) end
    );
    insert into public.theme_draft_operations (
      restaurant_id, request_id, request_fingerprint, expected_revision,
      template_id, tokens, saved_by, result
    ) values (
      p_restaurant_id, p_request_id, p_request_fingerprint, p_expected_revision,
      p_template_id, p_tokens, p_saved_by, v_result
    );
    return v_result;
  end if;

  select revision, tokens into v_published_revision, v_published_tokens
  from public.theme_configs where restaurant_id = p_restaurant_id;
  if not found then
    v_published_revision := 0;
    v_published_tokens := '{}'::jsonb;
  end if;
  v_next_revision := v_current.revision + 1;
  v_now := clock_timestamp();

  insert into public.theme_drafts (
    restaurant_id, template_id, tokens, revision,
    based_on_published_revision, updated_by, updated_at
  ) values (
    p_restaurant_id, p_template_id, p_tokens, v_next_revision,
    v_published_revision, p_saved_by, v_now
  ) on conflict (restaurant_id) do update set
    template_id = excluded.template_id,
    tokens = excluded.tokens,
    revision = excluded.revision,
    based_on_published_revision = excluded.based_on_published_revision,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at;

  v_result := jsonb_build_object(
    'status', 'saved',
    'revision', v_next_revision,
    'basedOnPublishedRevision', v_published_revision,
    'savedAt', v_now,
    'hasUnpublishedChanges', p_tokens <> v_published_tokens
  );
  insert into public.theme_draft_operations (
    restaurant_id, request_id, request_fingerprint, expected_revision,
    template_id, tokens, saved_by, result
  ) values (
    p_restaurant_id, p_request_id, p_request_fingerprint, p_expected_revision,
    p_template_id, p_tokens, p_saved_by, v_result
  );
  return v_result;
end;
$$;

create function public.publish_saved_theme_draft_atomic(
  p_restaurant_id uuid,
  p_published_by uuid,
  p_expected_draft_revision bigint,
  p_expected_published_revision bigint,
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
  v_draft public.theme_drafts%rowtype;
  v_operation public.theme_publish_operations%rowtype;
  v_current_revision bigint := 0;
  v_current_tokens jsonb := '{}'::jsonb;
  v_current_published_at timestamptz;
  v_next_revision bigint;
  v_now timestamptz;
  v_result jsonb;
begin
  if p_restaurant_id is null or p_published_by is null or p_request_id is null
     or p_expected_draft_revision is null or p_expected_draft_revision <= 0
     or p_expected_published_revision is null or p_expected_published_revision < 0
     or p_request_fingerprint is null
     or p_request_fingerprint !~ '^[a-f0-9]{64}$' then
    raise exception 'theme_saved_publish_request_invalid' using errcode = '22023';
  end if;

  select slug, owner_id into v_slug, v_owner_id
  from public.restaurants
  where id = p_restaurant_id and deleted_at is null
  for update;
  if not found then raise exception 'restaurant_not_found' using errcode = 'P0002'; end if;
  if v_owner_id <> p_published_by and not exists (
    select 1 from public.restaurant_members member
    where member.restaurant_id = p_restaurant_id
      and member.user_id = p_published_by
      and member.status = 'active'
      and member.permissions ? 'theme'
  ) then
    raise exception 'theme_publisher_not_authorized' using errcode = '42501';
  end if;

  select * into v_draft from public.theme_drafts
  where restaurant_id = p_restaurant_id for update;
  if not found then raise exception 'theme_draft_not_found' using errcode = 'P0002'; end if;

  select * into v_operation from public.theme_publish_operations
  where restaurant_id = p_restaurant_id and request_id = p_request_id;
  if found then
    if v_operation.request_fingerprint <> p_request_fingerprint
       or v_operation.expected_revision <> p_expected_published_revision
       or v_operation.draft_revision is distinct from p_expected_draft_revision
       or v_operation.template_id <> v_draft.template_id
       or v_operation.tokens <> v_draft.tokens
       or v_operation.published_by <> p_published_by then
      raise exception 'theme_publish_idempotency_conflict' using errcode = 'P0001';
    end if;
    if v_operation.result ->> 'status' = 'published' then
      return jsonb_set(v_operation.result, '{status}', to_jsonb('replayed'::text), true);
    end if;
    return v_operation.result;
  end if;

  if v_draft.revision <> p_expected_draft_revision then
    v_result := jsonb_build_object(
      'status', 'draft_conflict',
      'snapshot', jsonb_build_object(
        'templateId', v_draft.template_id,
        'tokens', v_draft.tokens,
        'revision', v_draft.revision,
        'basedOnPublishedRevision', v_draft.based_on_published_revision,
        'savedAt', v_draft.updated_at
      )
    );
  else
    select revision, tokens, published_at
    into v_current_revision, v_current_tokens, v_current_published_at
    from public.theme_configs where restaurant_id = p_restaurant_id for update;
    if not found then
      v_current_revision := 0;
      v_current_tokens := '{}'::jsonb;
      v_current_published_at := null;
    end if;
    if v_current_revision <> p_expected_published_revision then
      v_result := jsonb_build_object(
        'status', 'conflict',
        'snapshot', jsonb_build_object(
          'revision', v_current_revision,
          'templateId', coalesce(nullif(v_current_tokens ->> '__template_id', ''), 'default'),
          'tokens', v_current_tokens,
          'publishedAt', v_current_published_at
        )
      );
    end if;
  end if;

  if v_result is not null then
    insert into public.theme_publish_operations (
      restaurant_id, request_id, request_fingerprint, expected_revision,
      draft_revision, template_id, tokens, published_by, result
    ) values (
      p_restaurant_id, p_request_id, p_request_fingerprint, p_expected_published_revision,
      p_expected_draft_revision, v_draft.template_id, v_draft.tokens, p_published_by, v_result
    );
    return v_result;
  end if;

  v_next_revision := v_current_revision + 1;
  v_now := clock_timestamp();
  insert into public.theme_configs (
    restaurant_id, tokens, updated_by, updated_at, revision, published_at
  ) values (
    p_restaurant_id, v_draft.tokens, p_published_by, v_now, v_next_revision, v_now
  ) on conflict (restaurant_id) do update set
    tokens = excluded.tokens,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at,
    revision = excluded.revision,
    published_at = excluded.published_at;

  update public.restaurants set
    settings = coalesce(settings, '{}'::jsonb)
      || jsonb_build_object('active_template_id', v_draft.template_id),
    updated_at = v_now
  where id = p_restaurant_id;

  insert into public.theme_config_history (
    restaurant_id, revision, template_id, tokens, published_by,
    published_at, request_id, request_fingerprint
  ) values (
    p_restaurant_id, v_next_revision, v_draft.template_id, v_draft.tokens,
    p_published_by, v_now, p_request_id, p_request_fingerprint
  );
  update public.theme_drafts set based_on_published_revision = v_next_revision
  where restaurant_id = p_restaurant_id;

  v_result := jsonb_build_object(
    'status', 'published', 'revision', v_next_revision,
    'draftRevision', v_draft.revision, 'publishedAt', v_now, 'slug', v_slug
  );
  insert into public.theme_publish_operations (
    restaurant_id, request_id, request_fingerprint, expected_revision,
    draft_revision, template_id, tokens, published_by, result
  ) values (
    p_restaurant_id, p_request_id, p_request_fingerprint, p_expected_published_revision,
    p_expected_draft_revision, v_draft.template_id, v_draft.tokens, p_published_by, v_result
  );
  return v_result;
end;
$$;

revoke all on function public.save_theme_draft_atomic(uuid, text, jsonb, uuid, bigint, uuid, text)
  from public, anon, authenticated;
revoke all on function public.publish_saved_theme_draft_atomic(uuid, uuid, bigint, bigint, uuid, text)
  from public, anon, authenticated;
grant execute on function public.save_theme_draft_atomic(uuid, text, jsonb, uuid, bigint, uuid, text)
  to service_role;
grant execute on function public.publish_saved_theme_draft_atomic(uuid, uuid, bigint, bigint, uuid, text)
  to service_role;

comment on function public.save_theme_draft_atomic(uuid, text, jsonb, uuid, bigint, uuid, text)
  is 'Revisioned and idempotent private theme draft save; service-role only.';
comment on function public.publish_saved_theme_draft_atomic(uuid, uuid, bigint, bigint, uuid, text)
  is 'Publishes exactly one persisted theme draft revision; service-role only.';
