-- Forward-only fix: the initial list RPC filtered the lateral subscription row
-- through the projected name `subscription_status`. The lateral alias exposes
-- the physical column as `status`; keep filtering there and project only after.

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
  v_result jsonb;
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

  with candidates as materialized (
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
        or (p_subscription_status = 'none' and bs.status is null)
        or bs.status = p_subscription_status
      )
      and (
        p_lifecycle = 'all'
        or (p_lifecycle = 'active' and r.deleted_at is null)
        or (p_lifecycle = 'deleted' and r.deleted_at is not null)
      )
  ), paged as (
    select * from candidates
    order by created_at desc, id desc
    limit p_limit offset p_offset
  ), items as (
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
        'latestInvoice', invoice.invoice,
        'usage', jsonb_build_object(
          'tables', coalesce(usage.table_count, 0),
          'menuItems', coalesce(usage.menu_item_count, 0),
          'teamMembers', coalesce(usage.team_member_count, 0),
          'activeOrders', coalesce(usage.active_order_count, 0),
          'openServiceRequests', coalesce(usage.open_service_request_count, 0)
        ),
        'attention', jsonb_build_object('reconciliationCount', coalesce(usage.reconciliation_count, 0))
      ) order by c.created_at desc, c.id desc
    ), '[]'::jsonb) as value
    from paged c
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
    ) invoice on true
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
    ) usage on true
  )
  select jsonb_build_object(
    'items', items.value,
    'totalCount', (select count(*) from candidates)
  ) into v_result
  from items;

  return v_result;
end;
$$;

revoke all on function public.list_platform_admin_tenants(text, text, text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.list_platform_admin_tenants(text, text, text, text, integer, integer) to service_role;
