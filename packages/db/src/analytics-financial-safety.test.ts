import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const adapter = readFileSync(new URL('./dashboard-read-model-port.ts', import.meta.url), 'utf8')
const migration = readFileSync(
  new URL('../supabase/migrations/20260730060000_analytics_time_range_indexes.sql', import.meta.url),
  'utf8',
)

test('analytics payment and cancellation projections retain money classification fields', () => {
  assert.match(adapter, /select\('total, payment_method, items'\)/)
  assert.match(adapter, /select\('total, status, items, created_at, paid_at, payment_method'\)/)
  assert.match(adapter, /paidAt: row\.paid_at/)
  assert.match(adapter, /paymentMethod: row\.payment_method/)
})

test('analytics time queries support an exclusive upper bound', () => {
  assert.match(adapter, /query = query\.lt\('paid_at', before\)/)
  assert.match(adapter, /query = query\.lt\('created_at', before\)/)
  assert.match(adapter, /sessionQuery = sessionQuery\.lt\('closed_at', before\)/)
  assert.match(adapter, /closedSessionsQuery = closedSessionsQuery\.lt\('closed_at', before\)/)
})

test('analytics range indexes match tenant and time predicates', () => {
  assert.match(migration, /orders \(restaurant_id, paid_at\)/)
  assert.match(migration, /table_sessions \(restaurant_id, closed_at\)/)
  assert.match(migration, /loyalty_transactions \(restaurant_id, created_at\)/)
  assert.doesNotMatch(migration, /grant .* anon|grant .* authenticated/i)
})
