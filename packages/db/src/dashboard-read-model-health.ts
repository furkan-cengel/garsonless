import {
  DASHBOARD_INSIGHTS_OPERATIONS,
  type DashboardInsightsOperation,
} from '@garsonless/application/read-models'
import { err, ok, type Result } from '@garsonless/domain'
import { createServiceClient } from './client'

export type DashboardInsightsHealthStatus = 'healthy' | 'warning' | 'critical'

export interface DashboardInsightsHealthThresholds {
  warning: { failures: number; degraded: number; p95DurationMs: number }
  critical: { failures: number; degraded: number; p95DurationMs: number }
}

export const DEFAULT_DASHBOARD_INSIGHTS_HEALTH_THRESHOLDS: DashboardInsightsHealthThresholds = {
  warning: { failures: 1, degraded: 3, p95DurationMs: 1_500 },
  critical: { failures: 5, degraded: 10, p95DurationMs: 3_000 },
}

export interface DashboardInsightsHealthOperationRollup {
  operation: DashboardInsightsOperation
  observationCount: number
  slowSuccessCount: number
  degradedCount: number
  failureCount: number
  issueCount: number
  affectedRestaurantCount: number
  p95DurationMs: number
  oldestObservationAt: string | null
  latestObservationAt: string | null
}

export interface DashboardInsightsHealthAlert {
  level: Exclude<DashboardInsightsHealthStatus, 'healthy'>
  operation: DashboardInsightsOperation
  metric: 'failures' | 'degraded' | 'p95-duration-ms'
  actual: number
  threshold: number
}

export interface DashboardInsightsHealthSnapshot {
  status: DashboardInsightsHealthStatus
  observedSince: string
  operations: DashboardInsightsHealthOperationRollup[]
  alerts: DashboardInsightsHealthAlert[]
}

interface DashboardInsightsHealthRpcRow {
  operation: string
  observation_count: number
  slow_success_count: number
  degraded_count: number
  failure_count: number
  issue_count: number
  affected_restaurant_count: number
  p95_duration_ms: number
  oldest_observation_at: string | null
  latest_observation_at: string | null
}

export interface ReadDashboardInsightsHealthOptions {
  since?: string
  now?: () => Date
  thresholds?: DashboardInsightsHealthThresholds
  rpc?: (since: string) => Promise<{
    data: DashboardInsightsHealthRpcRow[] | null
    error: { message: string } | null
  }>
}

const operationSet = new Set<string>(DASHBOARD_INSIGHTS_OPERATIONS)

function safeCount(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0
}

function alertFor(
  operation: DashboardInsightsOperation,
  metric: DashboardInsightsHealthAlert['metric'],
  actual: number,
  thresholds: { warning: number; critical: number },
): DashboardInsightsHealthAlert | null {
  if (actual >= thresholds.critical) {
    return { level: 'critical', operation, metric, actual, threshold: thresholds.critical }
  }
  if (actual >= thresholds.warning) {
    return { level: 'warning', operation, metric, actual, threshold: thresholds.warning }
  }
  return null
}

export function projectDashboardInsightsHealth(
  rows: DashboardInsightsHealthRpcRow[],
  observedSince: string,
  thresholds: DashboardInsightsHealthThresholds = DEFAULT_DASHBOARD_INSIGHTS_HEALTH_THRESHOLDS,
): DashboardInsightsHealthSnapshot {
  const operations = rows
    .filter((row): row is DashboardInsightsHealthRpcRow & { operation: DashboardInsightsOperation } => (
      operationSet.has(row.operation)
    ))
    .map((row) => ({
      operation: row.operation,
      observationCount: safeCount(row.observation_count),
      slowSuccessCount: safeCount(row.slow_success_count),
      degradedCount: safeCount(row.degraded_count),
      failureCount: safeCount(row.failure_count),
      issueCount: safeCount(row.issue_count),
      affectedRestaurantCount: safeCount(row.affected_restaurant_count),
      p95DurationMs: safeCount(row.p95_duration_ms),
      oldestObservationAt: row.oldest_observation_at,
      latestObservationAt: row.latest_observation_at,
    }))
    .sort((left, right) => left.operation.localeCompare(right.operation))

  const alerts = operations.flatMap((operation) => [
    alertFor(operation.operation, 'failures', operation.failureCount, {
      warning: thresholds.warning.failures,
      critical: thresholds.critical.failures,
    }),
    alertFor(operation.operation, 'degraded', operation.degradedCount, {
      warning: thresholds.warning.degraded,
      critical: thresholds.critical.degraded,
    }),
    alertFor(operation.operation, 'p95-duration-ms', operation.p95DurationMs, {
      warning: thresholds.warning.p95DurationMs,
      critical: thresholds.critical.p95DurationMs,
    }),
  ].filter((alert): alert is DashboardInsightsHealthAlert => alert !== null))

  const status: DashboardInsightsHealthStatus = alerts.some((alert) => alert.level === 'critical')
    ? 'critical'
    : alerts.length > 0
      ? 'warning'
      : 'healthy'

  return { status, observedSince, operations, alerts }
}

export async function readDashboardInsightsHealth(
  options: ReadDashboardInsightsHealthOptions = {},
): Promise<Result<DashboardInsightsHealthSnapshot>> {
  const now = options.now?.() ?? new Date()
  const since = options.since ?? new Date(now.getTime() - 15 * 60 * 1_000).toISOString()
  const rpc = options.rpc ?? (async (pSince: string) => {
    const { data, error } = await createServiceClient().rpc(
      'get_dashboard_query_observation_health',
      { p_since: pSince },
    )
    return { data, error }
  })
  const { data, error } = await rpc(since)
  if (error) return err(error.message)
  return ok(projectDashboardInsightsHealth(data ?? [], since, options.thresholds))
}
