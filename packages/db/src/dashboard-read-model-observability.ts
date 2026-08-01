import type {
  DashboardInsightsOperation,
  DashboardInsightsQueryObservation,
  DashboardInsightsQueryObserver,
  DashboardInsightsReadModelPort,
} from '@garsonless/application/read-models'
import type { Result } from '@garsonless/domain'

export interface DashboardInsightsObservabilityOptions {
  observer?: DashboardInsightsQueryObserver
  clock?: () => number
}

export interface StructuredDashboardInsightsObserverOptions {
  slowQueryThresholdMs?: number
  write?: (message: string, observation: DashboardInsightsQueryObservation) => void
}

export function createStructuredDashboardInsightsObserver(
  options: StructuredDashboardInsightsObserverOptions = {},
): DashboardInsightsQueryObserver {
  const slowQueryThresholdMs = options.slowQueryThresholdMs ?? 1_000
  const write = options.write ?? ((message, observation) => console.warn(message, observation))

  return {
    observe(observation) {
      if (observation.outcome === 'success' && observation.durationMs < slowQueryThresholdMs) return
      write('[dashboard-insights-query]', observation)
    },
  }
}

function errorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : String(cause)
}

async function emitSafely(
  observer: DashboardInsightsQueryObserver,
  observation: DashboardInsightsQueryObservation,
) {
  try {
    await observer.observe(observation)
  } catch {
    // Telemetry is deliberately best-effort and cannot change read semantics.
  }
}

async function observeResult<T>(
  operation: DashboardInsightsOperation,
  restaurantId: string,
  observer: DashboardInsightsQueryObserver,
  clock: () => number,
  run: () => Promise<Result<T>>,
  issueCount: (value: T) => number = () => 0,
): Promise<Result<T>> {
  const startedAt = clock()
  try {
    const result = await run()
    const durationMs = Math.max(0, clock() - startedAt)
    if (!result.ok) {
      await emitSafely(observer, {
        operation,
        restaurantId,
        durationMs,
        outcome: 'failure',
        issueCount: 1,
        error: result.error,
      })
      return result
    }

    const issues = issueCount(result.value)
    await emitSafely(observer, {
      operation,
      restaurantId,
      durationMs,
      outcome: issues > 0 ? 'degraded' : 'success',
      issueCount: issues,
    })
    return result
  } catch (cause) {
    await emitSafely(observer, {
      operation,
      restaurantId,
      durationMs: Math.max(0, clock() - startedAt),
      outcome: 'failure',
      issueCount: 1,
      error: errorMessage(cause),
    })
    throw cause
  }
}

export function withDashboardInsightsObservability(
  port: DashboardInsightsReadModelPort,
  options: DashboardInsightsObservabilityOptions = {},
): DashboardInsightsReadModelPort {
  const observer = options.observer ?? createStructuredDashboardInsightsObserver()
  const clock = options.clock ?? (() => performance.now())

  return {
    readAnalyticsCoreMetrics(input) {
      return observeResult('analytics-core', input.restaurantId, observer, clock, () => port.readAnalyticsCoreMetrics(input))
    },
    readOrderVolume(input) {
      return observeResult('order-volume', input.restaurantId, observer, clock, () => port.readOrderVolume(input))
    },
    readCollectedOrders(input) {
      return observeResult('collected-orders', input.restaurantId, observer, clock, () => port.readCollectedOrders(input))
    },
    readTableRefs(input) {
      return observeResult('table-refs', input.restaurantId, observer, clock, () => port.readTableRefs(input))
    },
    readTablePerformance(input) {
      return observeResult('table-performance', input.restaurantId, observer, clock, () => port.readTablePerformance(input))
    },
    readPanoMetrics(input) {
      return observeResult('pano-metrics', input.restaurantId, observer, clock, () => port.readPanoMetrics(input))
    },
    readPanoOperationalSource(input) {
      return observeResult(
        'pano-operational',
        input.restaurantId,
        observer,
        clock,
        () => port.readPanoOperationalSource(input),
        (value) => value.errors.length,
      )
    },
  }
}
