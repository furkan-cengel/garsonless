import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const aggregateSql = readFileSync(new URL(
  '../supabase/migrations/20260730080000_analytics_core_aggregate.sql',
  import.meta.url,
), 'utf8')
const indexSql = readFileSync(new URL(
  '../supabase/migrations/20260730060000_analytics_time_range_indexes.sql',
  import.meta.url,
), 'utf8')

test('analytics core is database-aggregated, tenant/time bounded and product bounded', () => {
  assert.match(aggregateSql, /create or replace function public\.read_analytics_core_metrics/)
  assert.match(aggregateSql, /o\.restaurant_id = p_restaurant_id/g)
  assert.match(aggregateSql, /o\.created_at >= p_since[\s\S]*o\.created_at < p_before/)
  assert.match(aggregateSql, /o\.paid_at >= p_since[\s\S]*o\.paid_at < p_before/)
  assert.match(aggregateSql, /group by period, name/)
  assert.match(aggregateSql, /limit 4000/)
  assert.match(aggregateSql, /'productOverflow'/)
  assert.match(aggregateSql, /generate_series\(0, 6\)/)
  assert.match(aggregateSql, /generate_series\(8, 22\)/)
})

test('analytics aggregate and indexes preserve the service-only tenant boundary', () => {
  assert.match(aggregateSql, /security definer/)
  assert.match(aggregateSql, /revoke all on function public\.read_analytics_core_metrics\([\s\S]*from public, anon, authenticated/)
  assert.match(aggregateSql, /grant execute on function public\.read_analytics_core_metrics\([\s\S]*to service_role/)
  assert.match(indexSql, /orders \(restaurant_id, paid_at\)/)
  assert.match(indexSql, /orders \(restaurant_id, created_at\)/)
  assert.match(indexSql, /table_sessions \(restaurant_id, closed_at\)/)
  assert.match(indexSql, /loyalty_transactions \(restaurant_id, created_at\)/)
  assert.match(aggregateSql, /order_refunds \(restaurant_id, refunded_at\)/)
  assert.match(aggregateSql, /dashboard_query_observations_operation_check[\s\S]*'analytics-core'/)
})
