import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  DEFAULT_DASHBOARD_INSIGHTS_HEALTH_THRESHOLDS,
  projectDashboardInsightsHealth,
  readDashboardInsightsHealth,
} from './dashboard-read-model-health'

const since = '2026-07-18T09:00:00.000Z'

function row(overrides: Record<string, unknown> = {}) {
  return {
    operation: 'order-volume',
    observation_count: 1,
    slow_success_count: 1,
    degraded_count: 0,
    failure_count: 0,
    issue_count: 0,
    affected_restaurant_count: 1,
    p95_duration_ms: 1_000,
    oldest_observation_at: since,
    latest_observation_at: since,
    ...overrides,
  }
}

test('empty anomaly window is healthy and keeps the observed boundary explicit', () => {
  assert.deepEqual(projectDashboardInsightsHealth([], since), {
    status: 'healthy',
    observedSince: since,
    operations: [],
    alerts: [],
  })
})

test('warning thresholds identify the operation and metric without exposing tenant detail', () => {
  const snapshot = projectDashboardInsightsHealth([
    row({ operation: 'table-refs', failure_count: 1, slow_success_count: 0, p95_duration_ms: 200 }),
    row({ operation: 'unknown-operation', failure_count: 99 }),
  ], since)

  assert.equal(snapshot.status, 'warning')
  assert.deepEqual(snapshot.operations.map((item) => item.operation), ['table-refs'])
  assert.deepEqual(snapshot.alerts, [{
    level: 'warning',
    operation: 'table-refs',
    metric: 'failures',
    actual: 1,
    threshold: DEFAULT_DASHBOARD_INSIGHTS_HEALTH_THRESHOLDS.warning.failures,
  }])
})

test('critical policy wins over warnings and malformed counts fail closed', () => {
  const snapshot = projectDashboardInsightsHealth([
    row({
      operation: 'pano-operational',
      observation_count: Number.NaN,
      slow_success_count: -2,
      degraded_count: 3,
      failure_count: 5,
      issue_count: -1,
      p95_duration_ms: 3_100,
    }),
  ], since)

  assert.equal(snapshot.status, 'critical')
  assert.equal(snapshot.operations[0]?.observationCount, 0)
  assert.equal(snapshot.operations[0]?.slowSuccessCount, 0)
  assert.equal(snapshot.operations[0]?.issueCount, 0)
  assert.deepEqual(snapshot.alerts.map((item) => [item.metric, item.level]), [
    ['failures', 'critical'],
    ['degraded', 'warning'],
    ['p95-duration-ms', 'critical'],
  ])
})

test('health reader uses a fixed 15-minute default window and preserves RPC errors as Result', async () => {
  let receivedSince = ''
  const healthy = await readDashboardInsightsHealth({
    now: () => new Date('2026-07-18T10:00:00.000Z'),
    rpc: async (rpcSince) => {
      receivedSince = rpcSince
      return { data: [], error: null }
    },
  })
  assert.equal(receivedSince, '2026-07-18T09:45:00.000Z')
  assert.equal(healthy.ok && healthy.value.status, 'healthy')

  const failed = await readDashboardInsightsHealth({
    since,
    rpc: async () => ({ data: null, error: { message: 'health RPC unavailable' } }),
  })
  assert.deepEqual(failed, { ok: false, error: 'health RPC unavailable' })
})

test('operations migration keeps health bounded, retention fixed and every RPC service-role only', () => {
  const migration = readFileSync(new URL(
    '../supabase/migrations/20260718020000_dashboard_query_observation_operations.sql',
    import.meta.url,
  ), 'utf8')

  assert.match(migration, /now\(\) - interval '7 days'/)
  assert.match(migration, /created_at < now\(\) - interval '30 days'/)
  assert.match(migration, /dashboard-query-observation-retention-daily/)
  assert.match(migration, /'17 3 \* \* \*'/)
  assert.match(migration, /revoke all on function public\.get_dashboard_query_observation_health\(timestamptz\)[\s\S]*from public, anon, authenticated/)
  assert.match(migration, /revoke all on function public\.prune_dashboard_query_observations\(\)[\s\S]*from public, anon, authenticated/)
  const healthReturnSignature = migration.match(/returns table \(([\s\S]*?)\)\nlanguage sql/)?.[1] ?? ''
  assert.doesNotMatch(healthReturnSignature, /\berror\b|\brestaurant_id\b/)
})
