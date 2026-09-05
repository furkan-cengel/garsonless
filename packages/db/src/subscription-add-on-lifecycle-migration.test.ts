import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql = readFileSync(
  new URL('../supabase/migrations/20260901090000_subscription_add_on_lifecycle.sql', import.meta.url),
  'utf8',
)

test('canonical DB add-on compatibility mirrors plan availability and fails closed', () => {
  assert.match(sql, /create function public\.is_valid_subscription_add_on_selection/)
  assert.match(sql, /'iyzico_online_payments', 'storefront_video_hero'/)
  assert.match(sql, /when 'starter' then p_add_ons <@ array\['storefront_video_hero'\]/)
  assert.match(sql, /when 'pro' then p_add_ons <@ array\['iyzico_online_payments'\]/)
  assert.match(sql, /billing_provider_operations_requested_add_ons_check/)
  assert.match(sql, /subscription_invoices_add_ons_check/)
})

test('provider add-on catalogue is exact-bound by add-on, plan and interval', () => {
  assert.match(sql, /add column plan text/)
  assert.match(sql, /add primary key \(add_on, plan, billing_interval\)/)
  assert.match(sql, /where add_on = p_add_ons\[1\][\s\S]*and plan = p_plan/)
  assert.match(sql, /provider_plan_ref = btrim\(p_provider_plan_ref\)/)
})

test('checkout and plan change accept only an active exact catalogue binding', () => {
  assert.match(sql, /create or replace function public\.prepare_subscription_checkout_with_add_ons_operation/)
  assert.match(sql, /v_catalog\.provider_gross_amount_minor <> p_amount_minor/)
  assert.match(sql, /create or replace function public\.prepare_subscription_plan_change/)
  assert.match(sql, /then 'add_on_add'[\s\S]*then 'add_on_remove'/)
  assert.match(sql, /billing_plan_change_noop/)
})

test('renewal hydration and paid application synchronize add-ons without provider guesswork', () => {
  const hydration = sql.match(/create or replace function public\.hydrate_subscription_invoice_from_provider_event[\s\S]*?\nend;\n\$\$;/)?.[0] ?? ''
  assert.match(hydration, /v_active_add_ons = p_add_ons/)
  assert.match(hydration, /v_change\.to_add_ons = p_add_ons/)
  assert.match(hydration, /where add_on = p_add_ons\[1\] and plan = p_plan/)
  assert.match(sql, /create function public\.sync_applied_subscription_change_add_ons/)
  assert.match(sql, /new\.status <> 'applied'/)
  assert.match(sql, /status = 'cancelled'/)
  assert.match(sql, /status = 'active'/)
})

test('owner read projection includes active and scheduled add-on snapshots', () => {
  assert.match(sql, /read_subscription_billing_settings_before_add_on_lifecycle/)
  assert.match(sql, /\{subscription,activeAddOns\}/)
  assert.match(sql, /\{subscription,scheduledAddOns\}/)
  assert.match(sql, /add_ons as "addOns"/)
  assert.match(sql, /grant execute on function public\.read_subscription_billing_settings\(uuid\) to service_role/)
})
