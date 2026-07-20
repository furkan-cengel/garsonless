import { randomUUID } from 'node:crypto'
import { createClient, createServiceClient } from '../src/client'
import { readDashboardInsightsHealth } from '../src/dashboard-read-model-health'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const service = createServiceClient()
const marker = `sd6-${randomUUID()}`
const insertedIds: number[] = []

async function main() {
  let primaryError: unknown = null
  try {
    const { data: restaurant, error: restaurantError } = await service
      .from('restaurants')
      .select('id')
      .eq('slug', 'test-cafe-b')
      .single()
    if (restaurantError || !restaurant) throw restaurantError ?? new Error('Test Cafe B unavailable')

    const { count: preExistingExpired, error: expiredReadError } = await service
      .from('dashboard_query_observations')
      .select('id', { count: 'exact', head: true })
      .lt('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1_000).toISOString())
    if (expiredReadError) throw expiredReadError
    assert(preExistingExpired === 0, 'Retention verification refused: pre-existing expired observations exist')

    const now = new Date()
    const fixtureRows = [
      {
        restaurant_id: restaurant.id,
        operation: 'table-refs' as const,
        outcome: 'failure' as const,
        duration_ms: 180,
        issue_count: 1,
        error: `${marker}:failure`,
        created_at: now.toISOString(),
      },
      {
        restaurant_id: restaurant.id,
        operation: 'order-volume' as const,
        outcome: 'success' as const,
        duration_ms: 1_800,
        issue_count: 0,
        error: `${marker}:slow`,
        created_at: now.toISOString(),
      },
      {
        restaurant_id: restaurant.id,
        operation: 'pano-operational' as const,
        outcome: 'degraded' as const,
        duration_ms: 900,
        issue_count: 2,
        error: `${marker}:degraded`,
        created_at: now.toISOString(),
      },
      {
        restaurant_id: restaurant.id,
        operation: 'collected-orders' as const,
        outcome: 'failure' as const,
        duration_ms: 50,
        issue_count: 1,
        error: `${marker}:expired`,
        created_at: new Date(now.getTime() - 31 * 24 * 60 * 60 * 1_000).toISOString(),
      },
    ]
    const { data: inserted, error: insertError } = await service
      .from('dashboard_query_observations')
      .insert(fixtureRows)
      .select('id')
    if (insertError || !inserted) throw insertError ?? new Error('Health fixtures unavailable')
    insertedIds.push(...inserted.map((item) => item.id))

    const since = new Date(now.getTime() - 5 * 60 * 1_000).toISOString()
    const health = await readDashboardInsightsHealth({ since })
    assert(health.ok, `Health rollup failed: ${health.ok ? '' : health.error}`)
    assert(health.value.status === 'warning', `Expected warning health, received ${health.value.status}`)
    assert(health.value.alerts.some((alert) => (
      alert.operation === 'table-refs' && alert.metric === 'failures'
    )), 'Failure threshold did not create an alert')
    assert(health.value.alerts.some((alert) => (
      alert.operation === 'order-volume' && alert.metric === 'p95-duration-ms'
    )), 'Slow query threshold did not create an alert')

    const anonHealth = await createClient().rpc('get_dashboard_query_observation_health', { p_since: since })
    const anonPrune = await createClient().rpc('prune_dashboard_query_observations')
    assert(anonHealth.error !== null, 'Anon client could read dashboard query health')
    assert(anonPrune.error !== null, 'Anon client could invoke dashboard query retention')

    const { data: pruned, error: pruneError } = await service.rpc('prune_dashboard_query_observations')
    if (pruneError) throw pruneError
    assert(pruned === 1, `Expected exactly one expired fixture to be pruned, received ${pruned}`)

    const { count: expiredFixtureCount, error: expiredFixtureError } = await service
      .from('dashboard_query_observations')
      .select('id', { count: 'exact', head: true })
      .eq('error', `${marker}:expired`)
    if (expiredFixtureError) throw expiredFixtureError
    assert(expiredFixtureCount === 0, 'Expired fixture survived retention sweep')

    console.log(JSON.stringify({
      fixture: { slug: 'test-cafe-b', restaurantId: restaurant.id },
      health: health.value,
      retention: { preExistingExpired, pruned, expiredFixtureCount },
      rls: { anonHealthDenied: true, anonPruneDenied: true },
    }, null, 2))
  } catch (error) {
    primaryError = error
  }

  if (insertedIds.length > 0) {
    const { error } = await service.from('dashboard_query_observations').delete().in('id', insertedIds)
    if (error) throw error
  }
  const { count, error: cleanupError } = await service
    .from('dashboard_query_observations')
    .select('id', { count: 'exact', head: true })
    .like('error', `${marker}:%`)
  if (cleanupError) throw cleanupError
  console.log(JSON.stringify({ cleanup: { dashboardQueryObservations: count } }))
  assert(count === 0, 'Dashboard insights health runtime left fixture rows')
  if (primaryError) throw primaryError
}

void main().catch((error: unknown) => {
  console.error(JSON.stringify({
    runtimeError: error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : error,
  }, null, 2))
  process.exitCode = 1
})
