-- Complimentary access is independent from paid subscription authority.
-- Grants are operator-managed, tenant-scoped and revocable; never email-based runtime exceptions.
create table public.restaurant_complimentary_access (
  restaurant_id uuid primary key references public.restaurants(id) on delete restrict,
  plan text not null default 'pro' check (plan = 'pro'),
  reason text not null check (char_length(btrim(reason)) between 10 and 1000),
  granted_by uuid not null references auth.users(id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz
);
alter table public.restaurant_complimentary_access enable row level security;
revoke all on public.restaurant_complimentary_access from public, anon, authenticated;
grant select, insert, update on public.restaurant_complimentary_access to service_role;

create function public.has_complimentary_pro_access(p_restaurant_id uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.restaurant_complimentary_access g
    join public.restaurants r on r.id = g.restaurant_id
    where g.restaurant_id = p_restaurant_id and g.revoked_at is null and r.deleted_at is null
    and not exists (select 1 from public.billing_subscriptions s
      where s.restaurant_id = p_restaurant_id and s.status = 'manual_hold')
  );
$$;
revoke all on function public.has_complimentary_pro_access(uuid) from public, anon, authenticated;
grant execute on function public.has_complimentary_pro_access(uuid) to service_role;

alter function public.read_restaurant_entitlement_context(uuid,text) rename to read_restaurant_entitlement_context_before_complimentary;
create function public.read_restaurant_entitlement_context(p_restaurant_id uuid,p_feature text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare ctx jsonb;
begin
  ctx := public.read_restaurant_entitlement_context_before_complimentary(p_restaurant_id,p_feature);
  if public.has_complimentary_pro_access(p_restaurant_id) and p_feature = any(array[
    'qr_menu','rich_product_content','theme_editor','qr_studio','table_management','staff_orders',
    'settlement','analytics_basic','team_management','inventory_management','multilingual_menu',
    'guest_ordering','service_requests','kitchen_display','split_payments','customer_accounts',
    'crm','loyalty','campaigns','analytics_advanced','browser_notifications',
    'theme_advanced_sections','theme_video_hero'
  ]) then
    ctx := ctx || jsonb_build_object('accessAllowed',true,'complimentaryPlan','pro');
    -- Keep the existing finite-date wire contract. The grant itself has no expiry;
    -- revocation is checked on every resolution. An explicit feature deny still wins.
    if coalesce(ctx->'override'->>'decision','') <> 'deny' then
      ctx := ctx || jsonb_build_object('override',jsonb_build_object(
        'feature',p_feature,'decision','allow','expiresAt','9999-12-31T23:59:59.000Z'));
    end if;
  end if;
  return ctx;
end;
$$;
revoke all on function public.read_restaurant_entitlement_context(uuid,text) from public, anon, authenticated;
grant execute on function public.read_restaurant_entitlement_context(uuid,text) to service_role;

-- These two database-enforced modules have independent commercial gates.
-- Their existing actor checks and write permissions remain in force.
alter function public.inventory_allowed(uuid) rename to inventory_allowed_before_complimentary;
create function public.inventory_allowed(p_restaurant uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select public.inventory_allowed_before_complimentary(p_restaurant)
    or public.has_complimentary_pro_access(p_restaurant);
$$;
revoke all on function public.inventory_allowed(uuid) from public, anon;
grant execute on function public.inventory_allowed(uuid) to authenticated, service_role;
alter function public.menu_translation_allowed(uuid) rename to menu_translation_allowed_before_complimentary;
create function public.menu_translation_allowed(p_restaurant uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select public.menu_translation_allowed_before_complimentary(p_restaurant)
    or public.has_complimentary_pro_access(p_restaurant);
$$;
revoke all on function public.menu_translation_allowed(uuid) from public, anon, authenticated;
grant execute on function public.menu_translation_allowed(uuid) to service_role;
