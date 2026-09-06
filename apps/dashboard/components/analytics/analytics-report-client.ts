import type { AnalyticsReportResponse, AnalyticsReportId } from '../../lib/actions/analytics'
import type { AnalyticsQuery } from '../../lib/analytics-filter-contract'

export async function fetchAnalyticsReportPayload(
  restaurantId: string,
  query: AnalyticsQuery,
  report: AnalyticsReportId,
  signal?: AbortSignal,
): Promise<AnalyticsReportResponse> {
  const response = await fetch('/api/analytics/report', {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ restaurantId, query, report }),
    signal,
  })
  const payload = await response.json().catch(() => null) as { error?: unknown; errorCode?: unknown } | null
  const fail = (error: string): AnalyticsReportResponse => ({ error, generatedAt: new Date().toISOString(), snapshotVersion: 0 })
  if (!response.ok) {
    return fail(typeof payload?.error === 'string' ? payload.error : 'Rapor verileri yüklenemedi.')
  }
  if (!payload || typeof payload !== 'object') return fail('Rapor verileri yüklenemedi.')
  return payload as AnalyticsReportResponse
}
