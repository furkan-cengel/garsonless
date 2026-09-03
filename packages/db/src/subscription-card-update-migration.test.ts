import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql = readFileSync(
  new URL('../supabase/migrations/20260901080000_subscription_card_update_hosted_flow.sql', import.meta.url),
  'utf8',
)

test('card update is one durable hosted operation bound to current provider lineage', () => {
  assert.match(sql, /operation_type = 'card_update\.initialize'/)
  assert.match(sql, /billing_provider_operations_one_live_card_update_idx/)
  assert.match(sql, /provider_ref\.ref_role = 'current'/)
  assert.match(sql, /billing_card_update_plan_change_in_progress/)
})

test('callback requires the initialized token and separately hashed one-time state', () => {
  assert.match(sql, /provider_checkout_ref = btrim\(p_provider_checkout_ref\)/)
  assert.match(sql, /extensions\.digest\(convert_to\(p_callback_state, 'utf8'\), 'sha256'\)/)
  assert.match(sql, /billing_card_update_callback_state_mismatch/)
  assert.match(sql, /'billing:payment-method-updated:v1:' \|\| v_operation\.id/)
})

test('card completion emits notification only and cannot create money or entitlement evidence', () => {
  const complete = sql.match(/create function public\.complete_subscription_card_update[\s\S]*?\nend;\n\$\$;/)?.[0] ?? ''
  assert.match(complete, /'payment_method\.updated'/)
  assert.doesNotMatch(complete, /insert into public\.subscription_(invoices|payment_attempts)/)
  assert.doesNotMatch(complete, /update public\.restaurants set plan/)
})

test('all card-update RPCs are service-role-only', () => {
  assert.match(sql, /revoke all on function public\.prepare_subscription_card_update[\s\S]*from public, anon, authenticated/)
  assert.match(sql, /grant execute on function public\.complete_subscription_card_update[\s\S]*to service_role/)
})
