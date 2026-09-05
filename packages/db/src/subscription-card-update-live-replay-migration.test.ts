import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql = readFileSync(
  new URL('../supabase/migrations/20260902030000_subscription_card_update_live_replay.sql', import.meta.url),
  'utf8',
)

test('a new request safely replays the live card-update operation before insert', () => {
  const liveLookup = sql.indexOf("operation.status in ('processing', 'awaiting_callback', 'requires_reconciliation')")
  const nonDispatchable = sql.indexOf("'dispatchable', false", liveLookup)
  const insert = sql.indexOf('insert into public.billing_provider_operations', liveLookup)
  assert.ok(liveLookup >= 0 && nonDispatchable > liveLookup && insert > nonDispatchable)
  assert.match(sql.slice(liveLookup, insert), /'duplicate', true/)
})

test('an elapsed callback session becomes terminal before a replacement is prepared', () => {
  const expire = sql.indexOf("set status = 'expired'")
  const liveLookup = sql.indexOf("operation.status in ('processing', 'awaiting_callback', 'requires_reconciliation')")
  assert.ok(expire >= 0 && liveLookup > expire)
  assert.match(sql, /provider_checkout_expires_at <= clock_timestamp\(\)/)
  assert.match(sql, /billing_card_update_callback_timeout/)
})

test('the replacement RPC remains service-role-only', () => {
  assert.match(sql, /revoke all on function public\.prepare_subscription_card_update[\s\S]*from public, anon, authenticated/)
  assert.match(sql, /grant execute on function public\.prepare_subscription_card_update[\s\S]*to service_role/)
})
