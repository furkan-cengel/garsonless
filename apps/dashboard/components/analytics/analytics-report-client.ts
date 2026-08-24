import type { AnalyticsPayload, AnalyticsReportId } from '../../lib/actions/analytics'
import type { AnalyticsQuery } from '../../lib/analytics-filter-contract'

export async function fetchAnalyticsReportPayload(
  restaurantId: string,
  query: AnalyticsQuery,
  report: AnalyticsReportId,
  signal?: AbortSignal,
): Promise<{
  data?: Partial<AnalyticsPayload>
  generatedAt?: string
  snapshotVersion?: number
  error?: string
}> {
  const response = await fetch('/api/analytics/report', {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ restaurantId, query, report }),
    signal,
  })
  const payload = await response.json().catch(() => null) as { error?: unknown; errorCode?: unknown } | null
  if (!response.ok) {
    return { error: typeof payload?.error === 'string' ? payload.error : 'Rapor verileri yüklenemedi.' }
  }
  if (!payload || typeof payload !== 'object') return { error: 'Rapor verileri yüklenemedi.' }
  return payload as {
    data?: Partial<AnalyticsPayload>
    generatedAt?: string
    snapshotVersion?: number
    error?: string
  }
}
