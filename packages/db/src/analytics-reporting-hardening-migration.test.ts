import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const migration = readFileSync(join(
  process.cwd(),
  'supabase/migrations/20260823020000_analytics_reporting_hardening.sql',
), 'utf8')

test('paid cancelled orders remain in gross collection and analytics gets narrow invalidations', () => {
  assert.match(migration, /analytics collected-order policy replacement/)
  assert.match(migration, /orders_analytics_active_count_idx/)
  assert.match(migration, /create or replace function public\.read_analytics_table_performance/)
  assert.match(migration, /group by o\.table_id/)
  assert.match(migration, /group by s\.table_id/)
  assert.match(migration, /revoke all on function public\.read_analytics_table_performance/)
  assert.match(migration, /has_restaurant_section\(restaurant_id, 'analytics'\)/)
  assert.match(migration, /revoke all on function public\.read_analytics_core_metrics/)
  assert.doesNotMatch(
    readFileSync(join(process.cwd(), 'supabase/migrations/20260730080000_analytics_core_aggregate.sql'), 'utf8')
      .split('collected_orders as (')[1]?.split('sales_groups as (')[0] ?? '',
    /status <> 'cancelled'/,
  )
})
