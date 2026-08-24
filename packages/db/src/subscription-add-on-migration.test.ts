import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(
  new URL('../supabase/migrations/20260824050000_subscription_checkout_add_ons.sql', import.meta.url),
  'utf8',
)

test('subscription add-on storage is service-role-only and Pro-scoped', () => {
  assert.match(migration, /create table public\.restaurant_subscription_add_ons/)
  assert.match(migration, /force row level security/)
  assert.match(migration, /revoke all on table public\.restaurant_subscription_add_ons from public, anon, authenticated/)
  assert.match(migration, /requested_plan = 'pro'/)
})

test('existing plan checkout RPC remains untouched while add-on checkout is additive', () => {
  assert.match(migration, /create function public\.prepare_subscription_checkout_with_add_ons_operation/)
  assert.doesNotMatch(migration, /create or replace function public\.prepare_subscription_checkout_operation/)
  assert.match(migration, /billing_add_on_catalog_unavailable/)
  assert.match(migration, /provider_gross_amount_minor <> p_amount_minor/)
  assert.match(migration, /provider_plan_ref <> btrim\(p_expected_provider_plan_ref\)/)
})

test('verified checkout activation and cancellation update add-on entitlement atomically', () => {
  assert.match(migration, /after update of status on public\.billing_provider_operations/)
  assert.match(migration, /insert into public\.restaurant_subscription_add_ons/)
  assert.match(migration, /after update of status, current_period_start, current_period_end on public\.billing_subscriptions/)
  assert.match(migration, /set current_period_start = new\.current_period_start/)
  assert.match(migration, /'addOnEntitlementsVersion', 1/)
  assert.match(migration, /'activeAddOns'/)
})
