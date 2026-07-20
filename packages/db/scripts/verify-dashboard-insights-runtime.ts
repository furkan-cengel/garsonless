import { randomUUID } from 'node:crypto'
import {
  readDashboardCollectedOrders,
  readDashboardOrderVolume,
  readDashboardTablePerformance,
  readDashboardTableRefs,
  readPanoOperationalSource,
  type DashboardInsightsQueryObservation,
} from '@garsonless/application/read-models'
import type { DashboardActorContext } from '@garsonless/domain'
import { createClient, createServiceClient } from '../src/client'
import { createPersistentDashboardInsightsObserver } from '../src/dashboard-read-model-observation-sink'
import { createDashboardInsightsReadModelPort } from '../src/dashboard-read-model-port'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const service = createServiceClient()
const marker = `sd5-${randomUUID()}`
let persistedObservationId: number | null = null

async function main() {
  let primaryError: unknown = null
  try {
    const { data: restaurant, error: restaurantError } = await service
      .from('restaurants')
      .select('id, owner_id')
      .eq('slug', 'test-cafe-b')
      .single()
    if (restaurantError || !restaurant) throw restaurantError ?? new Error('Test Cafe B unavailable')

    const observations: DashboardInsightsQueryObservation[] = []
    const port = createDashboardInsightsReadModelPort({
      observer: { observe(observation) { observations.push(observation) } },
    })
    const context: DashboardActorContext = {
      actor: 'dashboard-member',
      userId: restaurant.owner_id,
      restaurantId: restaurant.id,
      permissions: ['pano', 'analytics'],
      isOwner: true,
    }
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1_000).toISOString()
    const [volume, collected, tableRefs, tablePerformance, operational] = await Promise.all([
      readDashboardOrderVolume(context, {
        restaurantId: restaurant.id,
        section: 'pano',
        since,
        limit: 25,
      }, port),
      readDashboardCollectedOrders(context, {
        restaurantId: restaurant.id,
        section: 'analytics',
        since,
      }, port),
      readDashboardTableRefs(context, {
        restaurantId: restaurant.id,
        section: 'pano',
        includeDeleted: true,
      }, port),
      readDashboardTablePerformance(context, { restaurantId: restaurant.id, since }, port),
      readPanoOperationalSource(context, {
        restaurantId: restaurant.id,
        sessionSince: since,
        includePaymentStatus: true,
      }, port),
    ])

    for (const [label, result] of Object.entries({ volume, collected, tableRefs, tablePerformance, operational })) {
      assert(result.ok, `${label} runtime read failed: ${result.ok ? '' : result.error}`)
    }
    assert(volume.ok && collected.ok && tableRefs.ok && tablePerformance.ok && operational.ok, 'Read matrix incomplete')
    assert(observations.length === 5, `Expected 5 observations, received ${observations.length}`)
    assert(observations.every((item) => item.durationMs >= 0), 'Negative query duration observed')
    assert(observations.every((item) => item.outcome !== 'failure'), 'Runtime matrix contains a failed observation')
    assert(operational.value.errors.length === 0, `Pano operational source degraded: ${operational.value.errors.join('; ')}`)

    const operations = observations.map((item) => item.operation).sort()
    assert(JSON.stringify(operations) === JSON.stringify([
      'collected-orders',
      'order-volume',
      'pano-operational',
      'table-performance',
      'table-refs',
    ]), 'Observation operation coverage is incomplete')

    const sink = createPersistentDashboardInsightsObserver({
      slowQueryThresholdMs: 0,
      writeLog: () => undefined,
    })
    await sink.observe({
      operation: 'table-refs',
      restaurantId: restaurant.id,
      durationMs: 1,
      outcome: 'failure',
      issueCount: 1,
      error: marker,
    })
    const { data: persisted, error: persistedError } = await service
      .from('dashboard_query_observations')
      .select('id, operation, outcome, duration_ms, issue_count, error')
      .eq('restaurant_id', restaurant.id)
      .eq('error', marker)
      .single()
    if (persistedError || !persisted) throw persistedError ?? new Error('Persistent observation unavailable')
    persistedObservationId = persisted.id
    assert(persisted.operation === 'table-refs', 'Persisted operation drifted')
    assert(persisted.outcome === 'failure', 'Persisted outcome drifted')
    assert(persisted.duration_ms === 1 && persisted.issue_count === 1, 'Persisted metric fields drifted')

    const anonRead = await createClient().from('dashboard_query_observations').select('id').limit(1)
    assert(anonRead.error !== null, 'Anon client could read operational query observations')

    console.log(JSON.stringify({
      fixture: { slug: 'test-cafe-b', restaurantId: restaurant.id },
      runtimeMatrix: {
        orderVolume: volume.value.length,
        collectedOrders: collected.value.length,
        tableRefs: tableRefs.value.length,
        tablePerformance: {
          tables: tablePerformance.value.tables.length,
          orders: tablePerformance.value.orders.length,
          closedSessions: tablePerformance.value.closedSessions.length,
          openTables: tablePerformance.value.openTableIds.length,
        },
        panoOperational: {
          tables: operational.value.tables.length,
          openSessions: operational.value.openSessions.length,
          sourceErrors: operational.value.errors,
          paymentStatusVisible: operational.value.paymentConfigured,
        },
      },
      observations: observations
        .slice()
        .sort((a, b) => a.operation.localeCompare(b.operation))
        .map(({ operation, durationMs, outcome, issueCount }) => ({ operation, durationMs, outcome, issueCount })),
      persistentSink: {
        id: persisted.id,
        operation: persisted.operation,
        outcome: persisted.outcome,
        durationMs: persisted.duration_ms,
        issueCount: persisted.issue_count,
        anonReadDenied: true,
      },
    }, null, 2))
  } catch (error) {
    primaryError = error
  }

  if (persistedObservationId !== null) {
    const { error } = await service.from('dashboard_query_observations').delete().eq('id', persistedObservationId)
    if (error) throw error
  }
  const { count, error: cleanupError } = await service
    .from('dashboard_query_observations')
    .select('id', { count: 'exact', head: true })
    .eq('error', marker)
  if (cleanupError) throw cleanupError
  console.log(JSON.stringify({ cleanup: { dashboardQueryObservations: count } }))
  assert(count === 0, 'Dashboard insights runtime left an observation row')
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
