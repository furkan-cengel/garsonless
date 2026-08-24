-- Safe recovery for a split-card intent that never reached the provider.
-- Token-bound shares are deliberately immutable through this function.

create or replace function public.void_unstarted_split_share_atomic(
  p_share_id uuid,
  p_restaurant_id uuid
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_share public.payment_shares%rowtype;
begin
  select * into v_share
  from public.payment_shares
  where id = p_share_id and restaurant_id = p_restaurant_id
  for update;

  if not found then return 'not_found'; end if;
  if v_share.status <> 'declared' then return 'already_resolved'; end if;
  if v_share.method <> 'iyzico' then return 'invalid_method'; end if;
  if exists (
    select 1 from public.payment_share_tokens token where token.share_id = v_share.id
  ) then
    return 'provider_pending';
  end if;

  update public.payment_shares
  set status = 'void', checkout_amount = null,
      checkout_reserved_until = null, updated_at = now()
  where id = v_share.id;
  return 'voided';
end;
$$;

revoke all on function public.void_unstarted_split_share_atomic(uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.void_unstarted_split_share_atomic(uuid,uuid)
  to service_role;

-- Expose only safe provider-state metadata to the dashboard. The raw token
-- remains service-only in payment_share_tokens.
create or replace function public.read_session_settlement_bundle(
  p_restaurant_id uuid,
  p_session_id uuid,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_access jsonb;
  v_orders jsonb;
  v_shares jsonb;
  v_staff_labels jsonb := '[]'::jsonb;
begin
  select public.read_tables_command_access_bundle(p_restaurant_id, p_actor_user_id)
  into v_access;
  if coalesce((v_access ->> 'authorized')::boolean, false) is not true then
    return jsonb_build_object('authorized', false);
  end if;

  select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.created_at), '[]'::jsonb)
  into v_orders
  from (
    select orders.id, orders.total, orders.status, orders.paid_at,
      orders.payment_method, orders.settled_by, orders.created_at, orders.items
    from public.orders orders
    where orders.restaurant_id = p_restaurant_id
      and orders.table_session_id = p_session_id
      and orders.deleted_at is null and orders.status <> 'cancelled'
  ) row_data;

  select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.created_at), '[]'::jsonb)
  into v_shares
  from (
    select share.id, share.amount, share.method, share.status, share.label,
      share.settled_at, share.settled_by, share.created_at,
      share.checkout_reserved_until,
      exists (
        select 1 from public.payment_share_tokens token where token.share_id = share.id
      ) as provider_token_attached
    from public.payment_shares share
    where share.restaurant_id = p_restaurant_id
      and share.table_session_id = p_session_id and share.status <> 'void'
  ) row_data;

  if coalesce((v_access ->> 'auditLabelsAllowed')::boolean, false) then
    select coalesce(jsonb_agg(jsonb_build_object('userId', staff.user_id, 'email', staff.email)), '[]'::jsonb)
    into v_staff_labels
    from (
      select member.user_id, member.email
      from public.restaurant_members member
      where member.restaurant_id = p_restaurant_id
        and member.user_id is not null and member.status = 'active'
      union
      select actor.id, actor.email
      from auth.users actor
      where actor.id = p_actor_user_id and actor.email is not null
    ) staff;
  end if;

  return v_access || jsonb_build_object(
    'orders', v_orders,
    'shares', v_shares,
    'staffLabels', v_staff_labels
  );
end;
$$;

revoke all on function public.read_session_settlement_bundle(uuid,uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.read_session_settlement_bundle(uuid,uuid,uuid)
  to service_role;

comment on function public.void_unstarted_split_share_atomic(uuid,uuid) is
  'Voids one tenant-scoped iyzico share only when no provider token exists.';

-- Called only after a server-to-server CF-Retrieve response reports FAILURE
-- and its iyzico signature is verified. Matching the stored token hash keeps
-- the command bound to the exact provider checkout without exposing the token
-- in RPC arguments or logs. The token row is retained as audit evidence.
create or replace function public.void_verified_failed_split_share_atomic(
  p_share_id uuid,
  p_restaurant_id uuid,
  p_provider_token_hash text
)
returns text
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare v_share public.payment_shares%rowtype;
begin
  if p_provider_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid_provider_token_hash' using errcode = '22023';
  end if;
  select * into v_share
  from public.payment_shares
  where id = p_share_id and restaurant_id = p_restaurant_id
  for update;
  if not found then return 'not_found'; end if;
  if v_share.status <> 'declared' then return 'already_resolved'; end if;
  if v_share.method <> 'iyzico' then return 'invalid_method'; end if;
  if not exists (
    select 1 from public.payment_share_tokens token
    where token.share_id = v_share.id
      and encode(extensions.digest(token.token, 'sha256'), 'hex') = p_provider_token_hash
  ) then
    return 'provider_mapping_mismatch';
  end if;
  update public.payment_shares
  set status = 'void', checkout_amount = null,
      checkout_reserved_until = null, updated_at = now()
  where id = v_share.id;
  return 'voided';
end;
$$;

revoke all on function public.void_verified_failed_split_share_atomic(uuid,uuid,text)
  from public, anon, authenticated;
grant execute on function public.void_verified_failed_split_share_atomic(uuid,uuid,text)
  to service_role;

comment on function public.void_verified_failed_split_share_atomic(uuid,uuid,text) is
  'Voids one token-bound iyzico share after an application-verified signed FAILURE result.';
