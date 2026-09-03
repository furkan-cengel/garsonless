import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql = readFileSync(
  new URL('../supabase/migrations/20260901060000_subscription_plan_change_ledger.sql', import.meta.url),
  'utf8',
)

test('plan changes have a durable request, outbound operation and provider lineage', () => {
  assert.match(sql, /create table public\.subscription_change_requests/)
  assert.match(sql, /create table public\.billing_subscription_provider_refs/)
  assert.match(sql, /'subscription\.change'/)
  assert.match(sql, /provider_target_subscription_ref/)
  assert.match(sql, /subscription_change_requests_one_live_idx/)
})

test('phase 3a only schedules same-interval changes and never grants entitlements on provider acceptance', () => {
  assert.match(sql, /p_effective_policy <> 'next_period'/)
  assert.match(sql, /billing_plan_change_interval_requires_checkout/)
  assert.match(sql, /set scheduled_plan = v_change\.to_plan/)
  const finalize = sql.match(/create or replace function public\.finalize_subscription_plan_change[\s\S]*?\nend;\n\$\$;/)?.[0] ?? ''
  assert.doesNotMatch(finalize, /set plan = v_change\.to_plan/)
  assert.doesNotMatch(finalize, /update public\.restaurants\s+set plan/)
  assert.match(sql, /create constraint trigger assert_succeeded_plan_change_is_scheduled[\s\S]*deferrable initially deferred/)
})

test('provider result is exact-bound, replay-safe and emits one scheduled event', () => {
  assert.match(sql, /billing_plan_change_provider_mismatch/)
  assert.match(sql, /billing_plan_change_replay_conflict/)
  assert.match(sql, /'billing:plan-change-scheduled:v1:' \|\| v_change\.id/)
  assert.match(sql, /'plan\.change_scheduled'/)
})

test('plan-change tables and RPCs are service-role only', () => {
  assert.match(sql, /revoke all on table public\.subscription_change_requests from public, anon, authenticated/)
  assert.match(sql, /revoke all on table public\.billing_subscription_provider_refs from public, anon, authenticated/)
  assert.match(sql, /revoke all on function public\.prepare_subscription_plan_change[\s\S]*from public, anon, authenticated/)
  assert.match(sql, /grant execute on function public\.finalize_subscription_plan_change[\s\S]*to service_role/)
})
