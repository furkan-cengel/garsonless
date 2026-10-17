import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { PLAN_DEFINITIONS } from '../../domain/src/entitlements'

const sql = readFileSync(new URL('../supabase/migrations/20260929143000_complimentary_pro_access.sql', import.meta.url), 'utf8')

test('complimentary Pro grants exactly the canonical Pro catalogue, without paid add-ons', () => {
  const featureArray = sql.match(/p_feature = any\(array\[([\s\S]*?)\]\)/)?.[1]
  assert.ok(featureArray)
  const features = [...featureArray.matchAll(/'([^']+)'/g)].map(match => match[1]).sort()
  assert.deepEqual(features, [...PLAN_DEFINITIONS.pro.features].sort())
  assert.ok(!features.includes('online_payments'))
  assert.ok(!features.includes('multi_location'))
})

test('complimentary grants stay private, revocable and separate from paid billing authority', () => {
  assert.match(sql, /enable row level security/)
  assert.match(sql, /revoke all on public\.restaurant_complimentary_access from public, anon, authenticated/)
  assert.match(sql, /g\.revoked_at is null and r\.deleted_at is null/)
  assert.match(sql, /s\.status = 'manual_hold'/)
  assert.match(sql, /<> 'deny'/)
  assert.doesNotMatch(sql, /(?:update|insert into|delete from) public\.(?:billing_subscriptions|billing_invoices|restaurants)\b/i)
})
