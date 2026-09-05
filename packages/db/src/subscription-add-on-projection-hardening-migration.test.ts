import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql = readFileSync(
  new URL('../supabase/migrations/20260901091000_subscription_add_on_projection_hardening.sql', import.meta.url),
  'utf8',
)

test('billing settings never collapse to SQL null when there is no scheduled add-on change', () => {
  assert.match(sql, /create or replace function public\.read_subscription_billing_settings/)
  assert.match(sql, /v_scheduled_add_ons := coalesce\(v_scheduled_add_ons, '\{\}'::text\[\]\)/)
  assert.match(sql, /\{subscription,activeAddOns\}/)
  assert.match(sql, /\{subscription,scheduledAddOns\}/)
  assert.match(sql, /add_ons as "addOns"/)
})
