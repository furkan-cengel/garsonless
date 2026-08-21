import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql = readFileSync(new URL('../supabase/migrations/20260818010000_coupon_foundation.sql', import.meta.url), 'utf8')

test('coupon migration protects tenant data and atomically records usage', () => {
  assert.match(sql, /create table public\.coupons/i)
  assert.match(sql, /create table public\.coupon_redemptions/i)
  assert.match(sql, /alter table public\.coupons enable row level security/i)
  assert.match(sql, /for update/i)
  assert.match(sql, /COUPON_EXHAUSTED/)
  assert.match(sql, /COUPON_FIRST_ORDER_ONLY/)
  assert.match(sql, /p_coupon_updated_at timestamptz/)
  assert.match(sql, /COUPON_CHANGED/)
  assert.match(sql, /unique \(order_id\)/i)
  assert.match(sql, /release_order_coupon_redemption/i)
  assert.match(sql, /new\.kind = 'full'/i)
})
