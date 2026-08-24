import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const migration = readFileSync(join(
  process.cwd(),
  'supabase/migrations/20260824010000_analytics_payment_aggregate.sql',
), 'utf8')
const adapter = readFileSync(join(process.cwd(), 'src/dashboard-read-model-port.ts'), 'utf8')

test('payment analytics stays fixed-size and service-role only', () => {
  assert.match(migration, /create or replace function public\.read_analytics_payment_aggregate/)
  assert.match(migration, /payment_groups as \(/)
  assert.match(migration, /financial_summary as \(/)
  assert.match(migration, /refund_groups as \(/)
  assert.match(migration, /o\.paid_at < p_before/)
  assert.doesNotMatch(migration, /status <> 'cancelled'/)
  assert.match(migration, /revoke all on function public\.read_analytics_payment_aggregate/)
  assert.match(migration, /to service_role/)
  assert.match(adapter, /rpc\('read_analytics_payment_aggregate'/)
  assert.match(adapter, /parseAnalyticsPaymentAggregate/)
})
