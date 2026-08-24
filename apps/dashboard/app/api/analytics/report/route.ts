import { NextResponse } from 'next/server'
import { fetchAnalyticsReportData, type AnalyticsReportId } from '../../../../lib/actions/analytics'
import { validateAnalyticsQuery } from '../../../../lib/analytics-filter-contract'
import { serializeAnalyticsResponse } from '../../../../lib/analytics-payload-budget'

const MAX_BODY_BYTES = 1_024

export async function POST(request: Request) {
  const requestOrigin = request.headers.get('origin')
  if (requestOrigin) {
    const expectedHost = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
    let originHost: string | null = null
    try { originHost = new URL(requestOrigin).host } catch { /* rejected below */ }
    if (!expectedHost || originHost !== expectedHost) {
      return NextResponse.json({ error: 'Geçersiz istek kaynağı' }, { status: 403 })
    }
  }

  const rawBody = await request.text()
  if (rawBody.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Geçersiz rapor isteği' }, { status: 413 })
  }

  let input: unknown
  try {
    input = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Geçersiz rapor isteği' }, { status: 400 })
  }
  if (!input || typeof input !== 'object') {
    return NextResponse.json({ error: 'Geçersiz rapor isteği' }, { status: 400 })
  }
  const { restaurantId, query, report } = input as Record<string, unknown>
  if (typeof restaurantId !== 'string' || typeof report !== 'string' || !query || typeof query !== 'object') {
    return NextResponse.json({ error: 'Geçersiz rapor isteği' }, { status: 400 })
  }
  if (!validateAnalyticsQuery(query)) {
    return NextResponse.json({ error: 'Geçersiz rapor isteği' }, { status: 400 })
  }

  const data = await fetchAnalyticsReportData(restaurantId, query, report as AnalyticsReportId)
  const serialized = serializeAnalyticsResponse(data)
  if (!serialized.withinBudget) {
    return NextResponse.json(
      { error: 'Rapor çıktısı güvenli boyut sınırını aştı. Tarih aralığını daraltın.' },
      { status: 413, headers: { 'Cache-Control': 'no-store' } },
    )
  }
  const status = data.errorCode === 'INVALID_REQUEST'
    ? 400
    : data.errorCode === 'FORBIDDEN'
      ? 403
      : data.errorCode === 'FEATURE_LOCKED'
        ? 402
        : data.errorCode === 'LOAD_FAILED'
          ? 503
          : 200
  return new Response(serialized.body, {
    status,
    headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' },
  })
}
