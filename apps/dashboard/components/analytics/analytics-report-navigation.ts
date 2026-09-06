import { analyticsQueryToSearchParams, type AnalyticsQuery } from '../../lib/analytics-filter-contract'
import type { AnalyticsReportId } from '../../lib/actions/analytics'

export function analyticsReportUrl(pathname: string, search: string, report: AnalyticsReportId, query: AnalyticsQuery, resetTable = false): string {
  const old = new URLSearchParams(search)
  const params = analyticsQueryToSearchParams(query, report)
  if (report === 'items') {
    for (const key of ['sort', 'dir', ...(resetTable ? [] : ['page', 'detail'])]) {
      const value = old.get(key)
      if (value !== null) params.set(key, value)
    }
  }
  return `${pathname}${params.size ? `?${params}` : ''}`
}

export function readProductTableState(search: string, pageCount: number) {
  const params = new URLSearchParams(search)
  const sort = params.get('sort')
  const page = Number(params.get('page'))
  return {
    sort: (sort === 'name' || sort === 'count' ? sort : 'revenue') as 'name' | 'count' | 'revenue',
    direction: params.get('dir') === 'asc' ? 'asc' as const : 'desc' as const,
    page: Math.min(pageCount, Number.isSafeInteger(page) && page > 0 ? page : 1),
    detail: params.get('detail'),
  }
}

export function writeProductTableUrl(patch: Record<string, string | null>, push = false) {
  const url = new URL(window.location.href)
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) url.searchParams.delete(key)
    else url.searchParams.set(key, value)
  }
  window.history[push ? 'pushState' : 'replaceState'](null, '', `${url.pathname}${url.search}`)
}
