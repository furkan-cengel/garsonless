import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const migration = readFileSync(join(
  process.cwd(),
  'supabase/migrations/20260824020000_analytics_operation_aggregates.sql',
), 'utf8')
const adapter = readFileSync(join(process.cwd(), 'src/dashboard-read-model-port.ts'), 'utf8')

test('operation analytics aggregates staff rows and bounds abnormal close detail', () => {
  assert.match(migration, /read_analytics_staff_settlement_aggregate/)
  assert.match(migration, /group by o\.settled_by/)
  assert.match(migration, /read_analytics_abnormal_close_aggregate/)
  assert.match(migration, /limit 501/)
  assert.match(migration, /'overflow'/)
  assert.match(migration, /to service_role/g)
  assert.doesNotMatch(migration, /to authenticated/)
  assert.match(adapter, /rpc\('read_analytics_staff_settlement_aggregate'/)
  assert.match(adapter, /rpc\('read_analytics_abnormal_close_aggregate'/)
})
