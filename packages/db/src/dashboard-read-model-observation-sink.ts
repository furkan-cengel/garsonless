import type {
  DashboardInsightsQueryObservation,
  DashboardInsightsQueryObserver,
} from '@garsonless/application/read-models'
import { createServiceClient } from './client'
import { createStructuredDashboardInsightsObserver } from './dashboard-read-model-observability'
import { recordPlatformErrorEvent } from './platform-error-event-port'

export interface PersistentDashboardInsightsObserverOptions {
  slowQueryThresholdMs?: number
  persist?: (observation: DashboardInsightsQueryObservation) => Promise<void>
  writeLog?: (message: string, detail: unknown) => void
}

function shouldPersist(observation: DashboardInsightsQueryObservation, slowQueryThresholdMs: number) {
  return observation.outcome !== 'success' || observation.durationMs >= slowQueryThresholdMs
}

async function persistDashboardInsightObservation(observation: DashboardInsightsQueryObservation) {
  const { error } = await createServiceClient().from('dashboard_query_observations').insert({
    restaurant_id: observation.restaurantId,
    operation: observation.operation,
    outcome: observation.outcome,
    duration_ms: Math.round(observation.durationMs),
    issue_count: observation.issueCount,
    error: observation.error?.slice(0, 500) ?? null,
  })
  if (error) throw error
  if (observation.outcome !== 'success') {
    await recordPlatformErrorEvent({
      restaurantId: observation.restaurantId,
      app: 'dashboard',
      source: `dashboard-query.${observation.operation}`,
      publicCode: 'MAS-SVC-503',
      severity: observation.outcome === 'failure' ? 'error' : 'warning',
    })
  }
}

/**
 * Persists only anomalous/slow reads. The structured server log remains the
 * fallback when Postgres itself is unavailable, and sink failures never escape.
 */
export function createPersistentDashboardInsightsObserver(
  options: PersistentDashboardInsightsObserverOptions = {},
): DashboardInsightsQueryObserver {
  const slowQueryThresholdMs = options.slowQueryThresholdMs ?? 1_000
  const writeLog = options.writeLog ?? ((message, detail) => console.warn(message, detail))
  const structured = createStructuredDashboardInsightsObserver({ slowQueryThresholdMs, write: writeLog })
  const persist = options.persist ?? persistDashboardInsightObservation

  return {
    async observe(observation) {
      structured.observe(observation)
      if (!shouldPersist(observation, slowQueryThresholdMs)) return
      try {
        await persist(observation)
      } catch (cause) {
        writeLog('[dashboard-insights-query-sink-failure]', {
          operation: observation.operation,
          restaurantId: observation.restaurantId,
          cause: cause instanceof Error ? cause.message : String(cause),
        })
      }
    },
  }
}
