-- Phone-first customer authentication. V1 remains available during rollout;
-- new callers use this nullable-email, verified-contact contract.
alter table public.customer_auth_intents
  drop constraint if exists customer_auth_intents_flow_check;
alter table public.customer_auth_intents
  add constraint customer_auth_intents_flow_check check (flow in ('email', 'oauth', 'phone'));

create or replace function public.register_customer_auth_intent(
  p_nonce_hash text,
  p_flow text,
  p_context_hash text,
  p_expires_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  if p_nonce_hash !~ '^[0-9a-f]{64}$'
    or p_context_hash !~ '^[0-9a-f]{64}$'
    or p_flow not in ('email', 'oauth', 'phone')
    or p_expires_at <= now()
    or p_expires_at > now() + interval '11 minutes' then
    raise exception 'invalid customer auth intent' using errcode = '22023';
  end if;
  insert into public.customer_auth_intents (nonce_hash, flow, context_hash, expires_at)
  values (p_nonce_hash, p_flow, p_context_hash, p_expires_at)
  on conflict (nonce_hash) do nothing;
  get diagnostics v_count = row_count;
  return v_count = 1;
end;
$$;

create or replace function public.claim_customer_identity_atomic_v2(
  p_auth_user_id uuid,
  p_email text default null,
  p_name text default null,
  p_verified_phone text default null
)
returns table (id uuid, email text, name text, merged boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := nullif(lower(btrim(p_email)), '');
  v_phone text := nullif(btrim(p_verified_phone), '');
  v_name text := nullif(left(btrim(p_name), 80), '');
  v_auth_customer uuid;
  v_email_customer uuid;
  v_phone_customer uuid;
  v_survivor uuid;
  v_existing_auth uuid;
  v_email_auth uuid;
  v_phone_auth uuid;
  v_merged boolean := false;
begin
  if p_auth_user_id is null or (v_email is null and v_phone is null) then
    raise exception 'a verified email or phone is required' using errcode = '22023';
  end if;
  if v_email is not null and position('@' in v_email) < 2 then
    raise exception 'verified email is invalid' using errcode = '22023';
  end if;
  if v_phone is not null and v_phone !~ '^\+905[0-9]{9}$' then
    raise exception 'verified phone is invalid' using errcode = '22023';
  end if;

  -- Reject staff/platform identities before any customer data can change.
  -- The customer table trigger remains the second line of defence.
  perform public.assert_customer_identity_role_available(p_auth_user_id, 'customer');

  perform pg_advisory_xact_lock(hashtextextended('customer-auth:' || p_auth_user_id::text, 0));
  if v_email is not null then
    perform pg_advisory_xact_lock(hashtextextended('customer-email:' || v_email, 0));
  end if;
  if v_phone is not null then
    perform pg_advisory_xact_lock(hashtextextended('customer-phone:' || v_phone, 0));
  end if;

  select customer.id into v_auth_customer
  from public.customers customer
  where customer.auth_user_id = p_auth_user_id
    and customer.merged_into_customer_id is null
  for update;

  if v_email is not null then
    select claim.customer_id into v_email_customer
    from public.customer_identity_claims claim
    where claim.kind = 'email' and claim.normalized_value = v_email
    for update;
    if v_email_customer is null then
      select customer.id into v_email_customer
      from public.customers customer
      where lower(customer.email) = v_email and customer.merged_into_customer_id is null
      for update;
    end if;
  end if;

  if v_phone is not null then
    select claim.customer_id into v_phone_customer
    from public.customer_identity_claims claim
    where claim.kind = 'phone' and claim.normalized_value = v_phone
    for update;
    if v_phone_customer is null then
      select customer.id into v_phone_customer
      from public.customers customer
      where customer.phone = v_phone and customer.merged_into_customer_id is null
      for update;
    end if;
  end if;

  if v_email_customer is not null then
    select customer.auth_user_id into v_email_auth
    from public.customers customer where customer.id = v_email_customer for update;
  end if;
  if v_phone_customer is not null then
    select customer.auth_user_id into v_phone_auth
    from public.customers customer where customer.id = v_phone_customer for update;
  end if;
  if (v_email_auth is not null and v_email_auth <> p_auth_user_id)
    or (v_phone_auth is not null and v_phone_auth <> p_auth_user_id) then
    raise exception 'verified identity belongs to another auth account' using errcode = '42501';
  end if;

  v_survivor := coalesce(v_auth_customer, v_email_customer, v_phone_customer);
  if v_survivor is null then
    insert into public.customers as inserted_customer (auth_user_id, email, phone, name, verified_at)
    values (p_auth_user_id, v_email, v_phone, v_name, now())
    returning inserted_customer.id into v_survivor;
  end if;

  select customer.auth_user_id into v_existing_auth
  from public.customers customer where customer.id = v_survivor for update;
  if v_existing_auth is not null and v_existing_auth <> p_auth_user_id then
    raise exception 'verified identity belongs to another auth account' using errcode = '42501';
  end if;

  if v_auth_customer is not null and v_auth_customer <> v_survivor then
    perform public.merge_customer_identity_into(v_survivor, v_auth_customer, p_auth_user_id);
    v_merged := true;
  end if;
  if v_email_customer is not null and v_email_customer <> v_survivor then
    perform public.merge_customer_identity_into(v_survivor, v_email_customer, p_auth_user_id);
    v_merged := true;
  end if;
  if v_phone_customer is not null and v_phone_customer <> v_survivor then
    perform public.merge_customer_identity_into(v_survivor, v_phone_customer, p_auth_user_id);
    v_merged := true;
  end if;

  update public.customers customer
  set auth_user_id = p_auth_user_id,
      email = coalesce(v_email, customer.email),
      phone = coalesce(v_phone, customer.phone),
      name = coalesce(v_name, customer.name),
      verified_at = now()
  where customer.id = v_survivor;

  if v_email is not null then
    insert into public.customer_identity_claims (customer_id, kind, normalized_value, verified_at, source)
    values (v_survivor, 'email', v_email, now(), 'supabase_auth')
    on conflict (kind, normalized_value) do update set
      customer_id = excluded.customer_id,
      verified_at = excluded.verified_at,
      source = excluded.source,
      updated_at = now();
  end if;

  if v_phone is not null then
    insert into public.customer_identity_claims (customer_id, kind, normalized_value, verified_at, source)
    values (v_survivor, 'phone', v_phone, now(), 'supabase_auth')
    on conflict (kind, normalized_value) do update set
      customer_id = excluded.customer_id,
      verified_at = excluded.verified_at,
      source = excluded.source,
      updated_at = now();
  end if;

  return query
  select customer.id, customer.email, customer.name, v_merged
  from public.customers customer
  where customer.id = v_survivor;
end;
$$;

revoke all on function public.claim_customer_identity_atomic_v2(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.claim_customer_identity_atomic_v2(uuid, text, text, text)
  to service_role;
