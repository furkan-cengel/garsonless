-- Platform Admin Phase 6.2: safe, read-only tenant directory.
-- These projections deliberately omit owner identity, contacts, restaurant
-- settings, provider references, raw payloads and failure messages.

create or replace function public.list_platform_admin_tenants(
  p_search text default null,
  p_plan text default null,
  p_subscription_status text default null,
  p_lifecycle text default 'active',
  p_limit integer default 25,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_search text := nullif(lower(btrim(coalesce(p_search, ''))), '');
  v_total bigint;
  v_items jsonb;
begin
  if char_length(coalesce(p_search, '')) > 100
    or (p_plan is not null and p_plan not in ('free', 'starter', 'pro', 'enterprise'))
    or (p_subscription_status is not null and p_subscription_status not in (
      'trial', 'active', 'past_due', 'grace_period', 'suspended', 'cancelled', 'manual_hold', 'none'
    ))
    or p_lifecycle not in ('active', 'deleted', 'all')
    or p_limit not between 1 and 50
    or p_offset not between 0 and 10000
  then
    raise exception 'invalid platform tenant directory input' using errcode = '22023';
  end if;

  with candidates as (
    select r.id, r.name, r.slug, r.plan, r.timezone, r.created_at, r.updated_at, r.deleted_at,
      bs.plan as subscription_plan, bs.status as subscription_status,
      bs.current_period_end, bs.trial_ends_at, bs.grace_ends_at
    from public.restaurants r
    left join lateral (
      select s.plan, s.status, s.current_period_end, s.trial_ends_at, s.grace_ends_at
      from public.billing_subscriptions s
      where s.restaurant_id = r.id
      order by (s.status <> 'cancelled') desc, s.updated_at desc, s.id desc
      limit 1
    ) bs on true
    where (v_search is null or lower(r.name) like '%' || v_search || '%' or lower(r.slug) like '%' || v_search || '%')
      and (p_plan is null or r.plan = p_plan)
      and (
        p_subscription_status is null
        or (p_subscription_status = 'none' and bs.subscription_status is null)
        or bs.subscription_status = p_subscription_status
      )
      and (
        p_lifecycle = 'all'
        or (p_lifecycle = 'active' and r.deleted_at is null)
        or (p_lifecycle = 'deleted' and r.deleted_at is not null)
      )
  )
  select count(*) into v_total from candidates;

  with candidates as (
    select r.id, r.name, r.slug, r.plan, r.timezone, r.created_at, r.updated_at, r.deleted_at,
      bs.plan as subscription_plan, bs.status as subscription_status,
      bs.current_period_end, bs.trial_ends_at, bs.grace_ends_at
    from public.restaurants r
    left join lateral (
      select s.plan, s.status, s.current_period_end, s.trial_ends_at, s.grace_ends_at
      from public.billing_subscriptions s
      where s.restaurant_id = r.id
      order by (s.status <> 'cancelled') desc, s.updated_at desc, s.id desc
      limit 1
    ) bs on true
    where (v_search is null or lower(r.name) like '%' || v_search || '%' or lower(r.slug) like '%' || v_search || '%')
      and (p_plan is null or r.plan = p_plan)
      and (
        p_subscription_status is null
        or (p_subscription_status = 'none' and bs.subscription_status is null)
        or bs.subscription_status = p_subscription_status
      )
      and (
        p_lifecycle = 'all'
        or (p_lifecycle = 'active' and r.deleted_at is null)
        or (p_lifecycle = 'deleted' and r.deleted_at is not null)
      )
    order by r.created_at desc, r.id desc
    limit p_limit offset p_offset
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'slug', c.slug,
      'plan', c.plan,
      'timezone', c.timezone,
      'createdAt', c.created_at,
      'updatedAt', c.updated_at,
      'deletedAt', c.deleted_at,
      'subscription', case when c.subscription_status is null then null else jsonb_build_object(
        'plan', c.subscription_plan,
        'status', c.subscription_status,
        'currentPeriodEnd', c.current_period_end,
        'trialEndsAt', c.trial_ends_at,
        'graceEndsAt', c.grace_ends_at
      ) end,
      'latestInvoice', i.invoice,
      'usage', jsonb_build_object(
        'tables', coalesce(u.table_count, 0),
        'menuItems', coalesce(u.menu_item_count, 0),
        'teamMembers', coalesce(u.team_member_count, 0),
        'activeOrders', coalesce(u.active_order_count, 0),
        'openServiceRequests', coalesce(u.open_service_request_count, 0)
      ),
      'attention', jsonb_build_object('reconciliationCount', coalesce(u.reconciliation_count, 0))
    ) order by c.created_at desc, c.id desc
  ), '[]'::jsonb) into v_items
  from candidates c
  left join lateral (
    select jsonb_build_object(
      'id', si.id,
      'status', si.status,
      'amountDueMinor', si.amount_due_minor,
      'amountPaidMinor', si.amount_paid_minor,
      'currency', si.currency,
      'dueAt', si.due_at,
      'paidAt', si.paid_at,
      'failedAt', si.failed_at,
      'createdAt', si.created_at
    ) as invoice
    from public.subscription_invoices si
    where si.restaurant_id = c.id
    order by si.created_at desc, si.id desc
    limit 1
  ) i on true
  left join lateral (
    select
      (select count(*) from public.tables t where t.restaurant_id = c.id and t.deleted_at is null) as table_count,
      (select count(*) from public.menu_items mi join public.menu_categories mc on mc.id = mi.category_id
        where mc.restaurant_id = c.id and mc.deleted_at is null and mi.deleted_at is null) as menu_item_count,
      (select count(*) from public.restaurant_members rm where rm.restaurant_id = c.id and rm.status = 'active') as team_member_count,
      (select count(*) from public.orders o where o.restaurant_id = c.id and o.deleted_at is null
        and o.status in ('pending', 'pending_approval', 'sent_to_kitchen', 'preparing', 'ready', 'served')) as active_order_count,
      (select count(*) from public.service_requests sr where sr.restaurant_id = c.id and sr.status = 'pending') as open_service_request_count,
      (select count(*) from public.billing_reconciliation_jobs brj where brj.restaurant_id = c.id
        and brj.status in ('pending', 'running', 'discrepancy', 'failed')) as reconciliation_count
  ) u on true;

  return jsonb_build_object('items', v_items, 'totalCount', v_total);
end;
$$;

create or replace function public.read_platform_admin_tenant(p_restaurant_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'id', r.id,
    'name', r.name,
    'slug', r.slug,
    'plan', r.plan,
    'timezone', r.timezone,
    'createdAt', r.created_at,
    'updatedAt', r.updated_at,
    'deletedAt', r.deleted_at,
    'subscription', case when bs.status is null then null else jsonb_build_object(
      'plan', bs.plan,
      'status', bs.status,
      'currentPeriodEnd', bs.current_period_end,
      'trialEndsAt', bs.trial_ends_at,
      'graceEndsAt', bs.grace_ends_at
    ) end,
    'latestInvoice', invoices.latest_invoice,
    'invoices', invoices.items,
    'usage', jsonb_build_object(
      'tables', usage.table_count,
      'menuItems', usage.menu_item_count,
      'teamMembers', usage.team_member_count,
      'activeOrders', usage.active_order_count,
      'openServiceRequests', usage.open_service_request_count
    ),
    'attention', jsonb_build_object('reconciliationCount', usage.reconciliation_count),
    'activity', jsonb_build_object('lastOrderAt', usage.last_order_at)
  ) into v_result
  from public.restaurants r
  left join lateral (
    select s.plan, s.status, s.current_period_end, s.trial_ends_at, s.grace_ends_at
    from public.billing_subscriptions s
    where s.restaurant_id = r.id
    order by (s.status <> 'cancelled') desc, s.updated_at desc, s.id desc
    limit 1
  ) bs on true
  left join lateral (
    select
      coalesce(jsonb_agg(x.invoice order by x.created_at desc, x.id desc), '[]'::jsonb) as items,
      (jsonb_agg(x.invoice order by x.created_at desc, x.id desc)->0) as latest_invoice
    from (
      select si.id, si.created_at, jsonb_build_object(
        'id', si.id,
        'status', si.status,
        'amountDueMinor', si.amount_due_minor,
        'amountPaidMinor', si.amount_paid_minor,
        'currency', si.currency,
        'dueAt', si.due_at,
        'paidAt', si.paid_at,
        'failedAt', si.failed_at,
        'createdAt', si.created_at
      ) as invoice
      from public.subscription_invoices si
      where si.restaurant_id = r.id
      order by si.created_at desc, si.id desc
      limit 10
    ) x
  ) invoices on true
  left join lateral (
    select
      (select count(*) from public.tables t where t.restaurant_id = r.id and t.deleted_at is null) as table_count,
      (select count(*) from public.menu_items mi join public.menu_categories mc on mc.id = mi.category_id
        where mc.restaurant_id = r.id and mc.deleted_at is null and mi.deleted_at is null) as menu_item_count,
      (select count(*) from public.restaurant_members rm where rm.restaurant_id = r.id and rm.status = 'active') as team_member_count,
      (select count(*) from public.orders o where o.restaurant_id = r.id and o.deleted_at is null
        and o.status in ('pending', 'pending_approval', 'sent_to_kitchen', 'preparing', 'ready', 'served')) as active_order_count,
      (select count(*) from public.service_requests sr where sr.restaurant_id = r.id and sr.status = 'pending') as open_service_request_count,
      (select count(*) from public.billing_reconciliation_jobs brj where brj.restaurant_id = r.id
        and brj.status in ('pending', 'running', 'discrepancy', 'failed')) as reconciliation_count,
      (select max(o.created_at) from public.orders o where o.restaurant_id = r.id and o.deleted_at is null) as last_order_at
  ) usage on true
  where r.id = p_restaurant_id;

  return v_result;
end;
$$;

revoke all on function public.list_platform_admin_tenants(text, text, text, text, integer, integer) from public, anon, authenticated;
revoke all on function public.read_platform_admin_tenant(uuid) from public, anon, authenticated;
grant execute on function public.list_platform_admin_tenants(text, text, text, text, integer, integer) to service_role;
grant execute on function public.read_platform_admin_tenant(uuid) to service_role;
