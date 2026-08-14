import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql = readFileSync(new URL('../supabase/migrations/20260814090000_plan_catalog_v2.sql', import.meta.url), 'utf8')

test('catalog migration persists only the four commercial plans and six checkout variants', () => {
  assert.match(sql, /restaurants_plan_check[\s\S]+starter[\s\S]+plus[\s\S]+pro[\s\S]+business/)
  assert.match(sql, /billing_interval in \('monthly', 'annual'\)/)
  assert.match(sql, /requested_plan is null or requested_plan in \('starter', 'plus', 'pro'\)/)
  for (const [variant, amount] of [
    ['starter:monthly', 34900], ['starter:annual', 335040],
    ['plus:monthly', 69900], ['plus:annual', 671040],
    ['pro:monthly', 119900], ['pro:annual', 1151040],
  ] as const) assert.match(sql, new RegExp(`when '${variant}' then ${amount}`))
  assert.match(sql, /p_amount_minor <> v_expected_amount/)
  assert.match(sql, /'billingInterval', v_subscription\.billing_interval/)
  assert.match(sql, /billing_interval as "billingInterval"/)
})

test('restaurant creation and Pro trial are one authenticated atomic boundary', () => {
  assert.match(sql, /create or replace function public\.create_restaurant_with_pro_trial/)
  assert.match(sql, /auth\.uid\(\)/)
  assert.match(sql, /insert into public\.restaurants[\s\S]+insert into public\.billing_subscriptions/)
  assert.match(sql, /values \(btrim\(p_name\), p_slug, v_owner, 'pro'\)/)
  assert.match(sql, /p_intended_plan, 'monthly'/)
  assert.match(sql, /billing_subscriptions_intended_plan_check/)
  assert.match(sql, /set trial_days = 14/)
  assert.match(sql, /make_interval\(days => v_trial_days\)/)
  assert.match(sql, /additional_location_requires_sales_activation/)
})

test('expired trials lock access and preserve data while checkout reactivates the same subscription', () => {
  assert.match(sql, /create or replace function public\.read_restaurant_entitlement_context/)
  assert.match(sql, /set status = 'trial_expired'/)
  assert.match(sql, /'trial', 'trial_expired', 'system'/)
  assert.match(sql, /v_subscription\.status in \('active', 'past_due', 'grace_period'\)/)
  assert.match(sql, /'accessAllowed', v_access_allowed/)
  assert.match(sql, /where restaurant_id = v_operation\.restaurant_id and status <> 'cancelled'/)
  assert.match(sql, /provider = 'iyzico'[\s\S]+status = 'active'/)
  assert.doesNotMatch(sql, /delete from public\.restaurants/)
})

test('Business organization access is tenant-scoped and sales activated', () => {
  for (const table of ['organizations', 'organization_restaurants', 'organization_members']) {
    assert.match(sql, new RegExp(`create table public\\.${table}`))
  }
  assert.match(sql, /create or replace function public\.read_organization_restaurant_access/)
  assert.match(sql, /member\.user_id = auth\.uid\(\)/)
  assert.match(sql, /create or replace function public\.list_organization_restaurant_ids_for_user/)
  assert.match(sql, /create or replace function public\.sync_business_organization_member/)
  assert.match(sql, /new\.status = 'active'/)
  assert.match(sql, /create trigger restaurant_members_sync_business_organization/)
  assert.match(sql, /p_plan = 'business'/)
  assert.match(sql, /v_identity\.role <> 'superadmin'/)
  assert.match(sql, /grant execute on function public\.set_platform_admin_tenant_plan[\s\S]+to service_role/)
  assert.match(sql, /create or replace function public\.list_platform_admin_tenants/)
  assert.match(sql, /p_plan not in \('starter', 'plus', 'pro', 'business'\)/)
  assert.match(sql, /'trial', 'trial_expired', 'active'/)
})

test('retired plan writes are normalized and table creation has no quota branch', () => {
  assert.match(sql, /when 'free' then 'starter'/)
  assert.match(sql, /when 'enterprise' then 'business'/)
  assert.match(sql, /create trigger restaurants_normalize_plan_v2/)
  const tableWriter = sql.match(/create or replace function public\.create_table\([\s\S]+?\$\$;/)?.[0] ?? ''
  assert.match(tableWriter, /insert into public\.tables/)
  assert.doesNotMatch(tableWriter, /starter_limit|pro_limit|table_count >=/)
  assert.match(sql, /create or replace function public\.create_located_table\(/)
  assert.match(sql, /New application code does not use quota-shaped RPCs/)
  assert.match(sql, /from public\.create_table\(p_restaurant_id, p_label\)/)
  assert.doesNotMatch(sql, /return query select 'plan_limit'/)
})
