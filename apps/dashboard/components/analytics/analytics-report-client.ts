import type { AnalyticsPayload, AnalyticsReportId } from '../../lib/actions/analytics'
import type { AnalyticsQuery } from '../../lib/analytics-filter-contract'

export async function fetchAnalyticsReportPayload(
  restaurantId: string,
  query: AnalyticsQuery,
  report: AnalyticsReportId,
): Promise<Partial<AnalyticsPayload> & { error?: string }> {
  const response = await fetch('/api/analytics/report', {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ restaurantId, query, report }),
  })
  const payload = await response.json().catch(() => null) as { error?: unknown } | null
  if (!response.ok) {
    return { error: typeof payload?.error === 'string' ? payload.error : 'Rapor verileri yüklenemedi.' }
  }
  if (!payload || typeof payload !== 'object') return { error: 'Rapor verileri yüklenemedi.' }
  return payload as Partial<AnalyticsPayload> & { error?: string }
}
