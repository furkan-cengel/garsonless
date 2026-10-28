import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import type {
  DashboardInsightsQueryObservation,
  DashboardInsightsReadModelPort,
} from '@garsonless/application/read-models'
import { err, ok } from '@garsonless/domain'
import { DASHBOARD_INSIGHTS_PROJECTIONS } from './dashboard-read-model-contract'
import {
  createStructuredDashboardInsightsObserver,
  dashboardInsightsLogDetail,
  withDashboardInsightsObservability,
} from './dashboard-read-model-observability'
import { createPersistentDashboardInsightsObserver } from './dashboard-read-model-observation-sink'

function createPort(overrides: Partial<DashboardInsightsReadModelPort> = {}): DashboardInsightsReadModelPort {
  return {
    async readAnalyticsCoreMetrics() {
      return ok({
        currentOrders: 0, previousOrders: 0, currentSessions: 0, previousSessions: 0,
        currentRevenue: 0, previousRevenue: 0, currentPaidOrders: 0, previousPaidOrders: 0,
        sales: [], heatmap: [], products: [],
      })
    },
    async readOrderVolume() { return ok([]) },
    async readCollectedOrders() { return ok([]) },
    async readTableRefs() { return ok([]) },
    async readTablePerformance() {
      return ok({ tables: [], orders: [], closedSessions: [], openTableIds: [] })
    },
    async readPanoMetrics() {
      return ok({
        revenue: 0, revenueYesterday: 0, orders: 0, ordersYesterday: 0,
        paidOrders: 0, paidOrdersYesterday: 0, activeOrders: 0, pendingOrders: 0, preparingOrders: 0,
        sessions: 0, sessionsYesterday: 0, hourlySales: [], recentOrders: [],
        topItems: [], heatmap: [],
      })
    },
    async readPanoBusiness() {
      return err('not used')
    },
    async readPanoOperationalSource() {
      return ok({
        errors: [],
        tables: [],
        openTableSessions: [],
        pendingServiceRequests: [],
        paymentMode: null,
        paymentConfigured: false,
      })
    },
    ...overrides,
  }
}

test('dashboard insight projections stay narrow and every contract is used by the adapter', () => {
  assert.deepEqual(DASHBOARD_INSIGHTS_PROJECTIONS, {
    orderVolume: 'id, total, status, session_id, table_id, created_at',
    collectedOrders: 'total, paid_at, payment_method, created_at, table_id, items',
    tableRefs: 'id, label, deleted_at',
    panoTables: 'id, label, deleted_at',
    panoOpenSessions: 'id, table_id, opened_at',
    panoPaymentStatus: 'mode',
    panoOpenSessionOrders: 'table_session_id, status, total, paid_at',
    panoOpenSessionShares: 'table_session_id, amount, method, status',
    panoOpenServiceRequests: 'id, table_id, created_at, request_type',
  })

  const adapterSource = readFileSync(new URL('./dashboard-read-model-port.ts', import.meta.url), 'utf8')
  for (const projection of Object.keys(DASHBOARD_INSIGHTS_PROJECTIONS)) {
    assert.match(adapterSource, new RegExp(`DASHBOARD_INSIGHTS_PROJECTIONS\\.${projection}\\b`))
  }
  assert.doesNotMatch(adapterSource, /\.select\('\*'\)/)
})

test('insights observability records latency and a successful result without changing it', async () => {
  let now = 10
  const observations: DashboardInsightsQueryObservation[] = []
  const port = withDashboardInsightsObservability(createPort({
    async readOrderVolume() {
      now = 47
      return ok([{ id: 'order', total: 12, status: 'served', sessionId: null, tableId: null, createdAt: '' }])
    },
  }), {
    clock: () => now,
    observer: { observe: (observation) => { observations.push(observation) } },
  })

  const result = await port.readOrderVolume({ restaurantId: 'restaurant-a', since: '' })
  assert.equal(result.ok, true)
  assert.deepEqual(observations, [{
    operation: 'order-volume',
    restaurantId: 'restaurant-a',
    durationMs: 37,
    outcome: 'success',
    issueCount: 0,
  }])
})

test('pano partial failures are observable as degraded reads', async () => {
  const observations: DashboardInsightsQueryObservation[] = []
  const port = withDashboardInsightsObservability(createPort({
    async readPanoOperationalSource() {
      return ok({
        errors: ['Masalar: timeout', 'Aktif siparişler: unavailable'],
        tables: [],
        openTableSessions: [],
        pendingServiceRequests: [],
        paymentMode: null,
        paymentConfigured: false,
      })
    },
  }), {
    clock: () => 5,
    observer: { observe: (observation) => { observations.push(observation) } },
  })

  const result = await port.readPanoOperationalSource({
    restaurantId: 'restaurant-a',
    includePaymentStatus: false,
  })
  assert.equal(result.ok, true)
  assert.equal(observations[0]?.outcome, 'degraded')
  assert.equal(observations[0]?.issueCount, 2)
})

test('failed results and thrown errors are observed while preserving read semantics', async () => {
  const observations: DashboardInsightsQueryObservation[] = []
  const observer = {
    observe: (observation: DashboardInsightsQueryObservation) => { observations.push(observation) },
  }
  const failed = withDashboardInsightsObservability(createPort({
    async readCollectedOrders() { return err('database unavailable') },
  }), { observer, clock: () => 0 })
  const failedResult = await failed.readCollectedOrders({ restaurantId: 'restaurant-a', since: '' })
  assert.deepEqual(failedResult, err('database unavailable'))
  assert.deepEqual(observations[0], {
    operation: 'collected-orders',
    restaurantId: 'restaurant-a',
    durationMs: 0,
    outcome: 'failure',
    issueCount: 1,
    error: 'database unavailable',
  })

  const thrown = withDashboardInsightsObservability(createPort({
    async readTableRefs() { throw new Error('connection reset') },
  }), { observer, clock: () => 0 })
  await assert.rejects(
    thrown.readTableRefs({ restaurantId: 'restaurant-a' }),
    /connection reset/,
  )
  assert.equal(observations[1]?.outcome, 'failure')
  assert.equal(observations[1]?.error, 'connection reset')
})

test('observer failures never break successful reads', async () => {
  const port = withDashboardInsightsObservability(createPort(), {
    observer: { observe() { throw new Error('telemetry backend down') } },
  })
  assert.equal((await port.readTableRefs({ restaurantId: 'restaurant-a' })).ok, true)
})

test('async observers never extend the dashboard read critical path', async () => {
  let finishObservation: (() => void) | undefined
  const observationPending = new Promise<void>((resolve) => { finishObservation = resolve })
  const port = withDashboardInsightsObservability(createPort(), {
    observer: { observe: () => observationPending },
  })

  const result = await port.readTableRefs({ restaurantId: 'restaurant-a' })
  assert.equal(result.ok, true)
  finishObservation?.()
})

test('default insight log detail replaces raw tenant and error fields with bounded metadata', () => {
  const detail = dashboardInsightsLogDetail({
    operation: 'pano-metrics',
    restaurantId: 'restaurant-sensitive-id',
    durationMs: 100.6,
    outcome: 'failure',
    issueCount: 1,
    error: 'email@example.com failed',
  })
  assert.match(detail.restaurantRef, /^[a-f0-9]{12}$/)
  assert.equal(detail.durationMs, 101)
  assert.equal(detail.hasError, true)
  assert.doesNotMatch(JSON.stringify(detail), /restaurant-sensitive-id|email@example\.com/)
})

test('dashboard read-model defaults to structured non-persistent observation', () => {
  const adapter = readFileSync(new URL('./dashboard-read-model-port.ts', import.meta.url), 'utf8')
  assert.match(adapter, /observer: observability\.observer \?\? createStructuredDashboardInsightsObserver\(\)/)
  assert.doesNotMatch(adapter, /createPersistentDashboardInsightsObserver/)
})

test('structured observer emits only degraded, failed, or slow reads', () => {
  const emitted: DashboardInsightsQueryObservation[] = []
  const observer = createStructuredDashboardInsightsObserver({
    slowQueryThresholdMs: 100,
    write: (_message, observation) => emitted.push(observation),
  })
  const base = {
    operation: 'order-volume' as const,
    restaurantId: 'restaurant-a',
    issueCount: 0,
  }
  observer.observe({ ...base, durationMs: 99, outcome: 'success' })
  observer.observe({ ...base, durationMs: 100, outcome: 'success' })
  observer.observe({ ...base, durationMs: 1, outcome: 'degraded', issueCount: 1 })
  observer.observe({ ...base, durationMs: 1, outcome: 'failure', issueCount: 1, error: 'failed' })
  assert.deepEqual(emitted.map((item) => item.outcome), ['success', 'degraded', 'failure'])
})

test('persistent observer stores only anomalous or slow reads', async () => {
  const persisted: DashboardInsightsQueryObservation[] = []
  const logs: string[] = []
  const observer = createPersistentDashboardInsightsObserver({
    slowQueryThresholdMs: 100,
    persist: async (observation) => { persisted.push(observation) },
    writeLog: (message) => { logs.push(message) },
  })
  const base = {
    operation: 'table-performance' as const,
    restaurantId: 'restaurant-a',
    issueCount: 0,
  }

  await observer.observe({ ...base, durationMs: 99, outcome: 'success' })
  await observer.observe({ ...base, durationMs: 100, outcome: 'success' })
  await observer.observe({ ...base, durationMs: 3, outcome: 'degraded', issueCount: 1 })

  assert.deepEqual(persisted.map((item) => item.outcome), ['success', 'degraded'])
  assert.deepEqual(logs, ['[dashboard-insights-query]', '[dashboard-insights-query]'])
})

test('persistent sink failure falls back to structured logging and never rejects', async () => {
  const logs: Array<{ message: string; detail: unknown }> = []
  const observer = createPersistentDashboardInsightsObserver({
    persist: async () => { throw new Error('database unavailable') },
    writeLog: (message, detail) => { logs.push({ message, detail }) },
  })

  await observer.observe({
    operation: 'pano-operational',
    restaurantId: 'restaurant-a',
    durationMs: 1,
    outcome: 'failure',
    issueCount: 1,
    error: 'source unavailable',
  })
  assert.deepEqual(logs.map((item) => item.message), [
    '[dashboard-insights-query]',
    '[dashboard-insights-query-sink-failure]',
  ])
})
