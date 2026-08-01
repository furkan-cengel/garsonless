import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(new URL(
  '../supabase/migrations/20260731120000_analytics_financial_input_guards.sql',
  import.meta.url,
), 'utf8')

test('financial input guards abort on invalid legacy rows without rewriting history', () => {
  assert.match(migration, /where total < 0 or total = 'NaN'::numeric/)
  assert.match(migration, /where jsonb_typeof\(items\) <> 'array'/)
  assert.match(migration, /raise exception using[\s\S]*errcode = '23514'/)
  assert.doesNotMatch(migration, /update\s+(public\.)?orders/i)
})

test('financial input guards reject negative, NaN and non-array writes', () => {
  assert.match(migration, /check \(total >= 0 and total <> 'NaN'::numeric\) not valid/)
  assert.match(migration, /check \(jsonb_typeof\(items\) = 'array'\) not valid/)
  assert.match(migration, /validate constraint orders_total_finite_nonnegative_check/)
  assert.match(migration, /validate constraint orders_items_array_check/)
})
