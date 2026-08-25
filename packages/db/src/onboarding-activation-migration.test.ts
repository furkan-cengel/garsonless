import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql = readFileSync(new URL('../supabase/migrations/20260824060000_onboarding_activation_flow.sql', import.meta.url), 'utf8')

test('onboarding state is private and owner mutations are RPC-only', () => {
  for (const table of ['restaurant_onboarding_states', 'restaurant_onboarding_operations']) {
    assert.match(sql, new RegExp(`alter table public\\.${table} force row level security`))
    assert.match(sql, new RegExp(`revoke all on public\\.${table} from public, anon, authenticated`))
  }
  assert.match(sql, /auth\.uid\(\)/)
  assert.match(sql, /restaurant\.owner_id = v_owner/)
})

test('restaurant, trial and resumable state are created atomically with idempotency', () => {
  assert.match(sql, /create or replace function public\.create_restaurant_with_pro_trial_v2/)
  assert.match(sql, /insert into public\.restaurants[\s\S]+insert into public\.billing_subscriptions[\s\S]+insert into public\.restaurant_onboarding_states/)
  assert.match(sql, /restaurant_onboarding_operations[\s\S]+request_payload/)
  assert.match(sql, /onboarding_idempotency_conflict/)
  assert.match(sql, /p_timezone[\s\S]+pg_timezone_names/)
  assert.doesNotMatch(sql, /drop function public\.create_restaurant_with_pro_trial\(/)
})

test('menu completion is owner-scoped, revision checked and requires a real item', () => {
  assert.match(sql, /create or replace function public\.create_onboarding_first_menu_item/)
  assert.match(sql, /for update of state/)
  assert.match(sql, /v_state\.revision <> p_expected_revision/)
  assert.match(sql, /insert into public\.menu_categories[\s\S]+insert into public\.menu_items[\s\S]+status = 'completed'/)
  assert.match(sql, /create or replace function public\.complete_onboarding_csv_menu[\s\S]+onboarding_menu_empty/)
})
