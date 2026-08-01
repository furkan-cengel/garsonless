-- Expand-first tenant payment credential vault.
--
-- Deployment order is deliberate:
--   1. Apply this migration while the legacy payment_credentials table remains.
--   2. Deploy readers which prefer this vault and temporarily read legacy rows.
--   3. Run owner-authorized rotation/backfill after every application instance is updated.
--   4. Verify payment_credentials is empty, then retire it in a separate migration.
--
-- Encryption/decryption happens only in the server adapter with AES-256-GCM.
-- The database never receives a plaintext tenant API or secret key.

create table public.payment_credential_vaults (
  restaurant_id uuid primary key references public.restaurants(id) on delete cascade,
  provider text not null default 'iyzico' check (provider = 'iyzico'),
  encrypted_payload jsonb not null,
  key_version text not null check (key_version ~ '^[A-Za-z0-9._-]{1,64}$'),
  api_key_last4 text not null check (api_key_last4 ~ '^.{4}$'),
  mode text not null default 'sandbox' check (mode in ('sandbox', 'live')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_credential_vault_envelope_check check (
    jsonb_typeof(encrypted_payload) = 'object'
    and encrypted_payload ->> 'schemaVersion' = '1'
    and encrypted_payload ->> 'algorithm' = 'A256GCM'
    and encrypted_payload ->> 'keyVersion' = key_version
    and jsonb_typeof(encrypted_payload -> 'apiKeyCipher') = 'object'
    and jsonb_typeof(encrypted_payload -> 'secretKeyCipher') = 'object'
    and not (encrypted_payload ? 'apiKey')
    and not (encrypted_payload ? 'secretKey')
    and not (encrypted_payload ? 'api_key')
    and not (encrypted_payload ? 'secret_key')
  )
);

create table public.payment_credential_write_operations (
  request_id uuid primary key,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  operation text not null check (operation in ('save', 'rotate', 'delete')),
  payload_fingerprint text not null check (payload_fingerprint ~ '^[a-f0-9]{64}$'),
  outcome jsonb not null,
  created_at timestamptz not null default now()
);

create index payment_credential_write_operations_restaurant_created_idx
  on public.payment_credential_write_operations (restaurant_id, created_at desc);

create table public.payment_credential_rotation_audit (
  id bigint generated always as identity primary key,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  request_id uuid not null unique,
  operation text not null check (operation in ('save', 'rotate', 'delete')),
  from_key_version text,
  to_key_version text,
  created_at timestamptz not null default now()
);

-- Compatibility read projection: new readers see vault rows immediately and
-- still report an unrotated tenant as configured during the expand window.
create view public.payment_credential_status
with (security_invoker = true)
as
select
  v.restaurant_id,
  v.mode,
  'encrypted'::text as protection,
  v.updated_at
from public.payment_credential_vaults v
union all
select
  l.restaurant_id,
  l.mode,
  'legacy-plaintext'::text as protection,
  l.updated_at
from public.payment_credentials l
where not exists (
  select 1 from public.payment_credential_vaults v where v.restaurant_id = l.restaurant_id
);

alter table public.payment_credential_vaults enable row level security;
alter table public.payment_credential_write_operations enable row level security;
alter table public.payment_credential_rotation_audit enable row level security;

revoke all on table public.payment_credential_vaults from public, anon, authenticated;
revoke all on table public.payment_credential_write_operations from public, anon, authenticated;
revoke all on table public.payment_credential_rotation_audit from public, anon, authenticated;
revoke all on table public.payment_credential_status from public, anon, authenticated;
grant select, insert, update, delete on table public.payment_credential_vaults to service_role;
grant select, insert, update, delete on table public.payment_credential_write_operations to service_role;
grant select, insert on table public.payment_credential_rotation_audit to service_role;
grant select on table public.payment_credential_status to service_role;
grant usage, select on sequence public.payment_credential_rotation_audit_id_seq to service_role;

create or replace function public.save_payment_credential_vault(
  p_restaurant_id uuid,
  p_actor_user_id uuid,
  p_request_id uuid,
  p_operation text,
  p_payload_fingerprint text,
  p_provider text,
  p_encrypted_payload jsonb,
  p_key_version text,
  p_api_key_last4 text,
  p_mode text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.payment_credential_write_operations%rowtype;
  v_previous_key_version text;
  v_outcome jsonb;
begin
  if p_operation not in ('save', 'rotate')
     or p_provider <> 'iyzico'
     or p_mode not in ('sandbox', 'live')
     or p_payload_fingerprint !~ '^[a-f0-9]{64}$'
     or p_api_key_last4 !~ '^.{4}$'
     or p_encrypted_payload ->> 'schemaVersion' <> '1'
     or p_encrypted_payload ->> 'algorithm' <> 'A256GCM'
     or p_encrypted_payload ->> 'keyVersion' <> p_key_version then
    raise exception using errcode = '22023', message = 'payment_credential_payload_invalid';
  end if;

  if not exists (
    select 1 from public.restaurants r
    where r.id = p_restaurant_id
      and r.owner_id = p_actor_user_id
      and r.deleted_at is null
  ) then
    raise exception using errcode = '42501', message = 'payment_credential_access_denied';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));
  select * into v_existing
  from public.payment_credential_write_operations
  where request_id = p_request_id;

  if found then
    if v_existing.restaurant_id <> p_restaurant_id
       or v_existing.operation <> p_operation
       or v_existing.payload_fingerprint <> p_payload_fingerprint then
      raise exception using errcode = '23505', message = 'payment_credential_request_conflict';
    end if;
    return v_existing.outcome || jsonb_build_object('idempotent', true);
  end if;

  select key_version into v_previous_key_version
  from public.payment_credential_vaults
  where restaurant_id = p_restaurant_id
  for update;

  if v_previous_key_version is null and exists (
    select 1 from public.payment_credentials where restaurant_id = p_restaurant_id
  ) then
    v_previous_key_version := 'legacy-plaintext';
  end if;

  insert into public.payment_credential_vaults (
    restaurant_id, provider, encrypted_payload, key_version, api_key_last4, mode
  ) values (
    p_restaurant_id, p_provider, p_encrypted_payload, p_key_version, p_api_key_last4, p_mode
  )
  on conflict (restaurant_id) do update set
    provider = excluded.provider,
    encrypted_payload = excluded.encrypted_payload,
    key_version = excluded.key_version,
    api_key_last4 = excluded.api_key_last4,
    mode = excluded.mode,
    updated_at = now();

  -- Atomic plaintext retirement for this tenant: a successful vault write can
  -- never leave the just-migrated legacy secret behind.
  delete from public.payment_credentials where restaurant_id = p_restaurant_id;

  v_outcome := jsonb_build_object(
    'configured', true,
    'mode', p_mode,
    'apiKeyLast4', p_api_key_last4,
    'keyVersion', p_key_version,
    'requiresRotation', false,
    'idempotent', false
  );

  insert into public.payment_credential_rotation_audit (
    restaurant_id, actor_user_id, request_id, operation, from_key_version, to_key_version
  ) values (
    p_restaurant_id, p_actor_user_id, p_request_id, p_operation, v_previous_key_version, p_key_version
  );

  insert into public.payment_credential_write_operations (
    request_id, restaurant_id, operation, payload_fingerprint, outcome
  ) values (
    p_request_id, p_restaurant_id, p_operation, p_payload_fingerprint, v_outcome
  );

  return v_outcome;
end;
$$;

create or replace function public.delete_payment_credential_vault(
  p_restaurant_id uuid,
  p_actor_user_id uuid,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.payment_credential_write_operations%rowtype;
  v_fingerprint text := encode(sha256(convert_to('delete:' || p_restaurant_id::text, 'UTF8')), 'hex');
  v_previous_key_version text;
  v_outcome jsonb := jsonb_build_object('configured', false, 'idempotent', false);
begin
  if not exists (
    select 1 from public.restaurants r
    where r.id = p_restaurant_id
      and r.owner_id = p_actor_user_id
      and r.deleted_at is null
  ) then
    raise exception using errcode = '42501', message = 'payment_credential_access_denied';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));
  select * into v_existing
  from public.payment_credential_write_operations
  where request_id = p_request_id;

  if found then
    if v_existing.restaurant_id <> p_restaurant_id
       or v_existing.operation <> 'delete'
       or v_existing.payload_fingerprint <> v_fingerprint then
      raise exception using errcode = '23505', message = 'payment_credential_request_conflict';
    end if;
    return v_existing.outcome || jsonb_build_object('idempotent', true);
  end if;

  select key_version into v_previous_key_version
  from public.payment_credential_vaults
  where restaurant_id = p_restaurant_id
  for update;
  if v_previous_key_version is null and exists (
    select 1 from public.payment_credentials where restaurant_id = p_restaurant_id
  ) then
    v_previous_key_version := 'legacy-plaintext';
  end if;

  delete from public.payment_credential_vaults where restaurant_id = p_restaurant_id;
  delete from public.payment_credentials where restaurant_id = p_restaurant_id;

  insert into public.payment_credential_rotation_audit (
    restaurant_id, actor_user_id, request_id, operation, from_key_version, to_key_version
  ) values (
    p_restaurant_id, p_actor_user_id, p_request_id, 'delete', v_previous_key_version, null
  );
  insert into public.payment_credential_write_operations (
    request_id, restaurant_id, operation, payload_fingerprint, outcome
  ) values (
    p_request_id, p_restaurant_id, 'delete', v_fingerprint, v_outcome
  );
  return v_outcome;
end;
$$;

revoke all on function public.save_payment_credential_vault(uuid, uuid, uuid, text, text, text, jsonb, text, text, text)
  from public, anon, authenticated;
revoke all on function public.delete_payment_credential_vault(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.save_payment_credential_vault(uuid, uuid, uuid, text, text, text, jsonb, text, text, text)
  to service_role;
grant execute on function public.delete_payment_credential_vault(uuid, uuid, uuid)
  to service_role;
