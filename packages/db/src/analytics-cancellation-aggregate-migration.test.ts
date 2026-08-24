import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const migration = readFileSync(join(
  process.cwd(),
  'supabase/migrations/20260824030000_analytics_cancellation_aggregate.sql',
), 'utf8')
const adapter = readFileSync(join(process.cwd(), 'src/dashboard-read-model-port.ts'), 'utf8')

test('cancellation analytics returns only bounded aggregates', () => {
  assert.match(migration, /read_analytics_cancellation_aggregate/)
  assert.match(migration, /period_metrics as \(/)
  assert.match(migration, /trend_groups as \(/)
  assert.match(migration, /top_items as \(/)
  assert.match(migration, /limit 5/)
  assert.match(migration, /to service_role/)
  assert.doesNotMatch(migration, /to authenticated/)
  assert.match(adapter, /rpc\('read_analytics_cancellation_aggregate'/)
  assert.match(adapter, /parseAnalyticsCancellationAggregate/)
})
