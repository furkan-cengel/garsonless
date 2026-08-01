'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import type { AnalyticsReportId } from '../../lib/actions/analytics'
import { fetchAnalyticsReportPayload } from './analytics-report-client'
import {
  canExportAnalyticsReport,
  createInitialAnalyticsData,
  createInitialLoadedReports,
  createUnloadedReports,
  markAnalyticsReportLoaded,
  type AnalyticsInitialData,
  type AnalyticsQuery,
  type AnalyticsRange,
} from './analytics-report-model'
import { analyticsQueryEquals, analyticsQueryToSearchParams, parseAnalyticsQuery } from '../../lib/analytics-filter-contract'

export function useAnalyticsReports({
  restaurantId,
  initialData,
  isOwner,
  hasAdvancedAnalytics,
  initialQuery,
  initialReport,
}: {
  restaurantId: string
  initialData: AnalyticsInitialData
  isOwner: boolean
  hasAdvancedAnalytics: boolean
  initialQuery: AnalyticsQuery
  initialReport: AnalyticsReportId
}) {
  const [activeReport, setActiveReport] = useState<AnalyticsReportId>(initialReport)
  const [query, setQuery] = useState<AnalyticsQuery>(initialQuery)
  const [analyticsData, setAnalyticsData] = useState(() => createInitialAnalyticsData(initialData))
  const [loadedReports, setLoadedReports] = useState(() => createInitialLoadedReports(initialData))
  const [isPending, startTransition] = useTransition()
  const [loadError, setLoadError] = useState<string | null>(null)
  const latestRequestRef = useRef(0)
  const initialReportLoadRef = useRef(false)
  const initialUrlSyncRef = useRef(false)
  const retryRequestRef = useRef<{
    report: AnalyticsReportId
    query: AnalyticsQuery
    commitQuery: boolean
  } | null>(null)

  const syncUrl = useCallback((report: AnalyticsReportId, nextQuery: AnalyticsQuery, replace = false) => {
    const params = analyticsQueryToSearchParams(nextQuery, report)
    const url = `${window.location.pathname}${params.size > 0 ? `?${params.toString()}` : ''}`
    window.history[replace ? 'replaceState' : 'pushState'](null, '', url)
  }, [])

  const loadReport = useCallback((
    report: AnalyticsReportId,
    nextQuery: AnalyticsQuery = query,
    commitQuery = false,
    updateHistory = true,
  ) => {
    const requestId = ++latestRequestRef.current
    retryRequestRef.current = { report, query: nextQuery, commitQuery }
    startTransition(async () => {
      setLoadError(null)
      try {
        const data = await fetchAnalyticsReportPayload(restaurantId, nextQuery, report)
        if (requestId !== latestRequestRef.current) return
        if (data.error) {
          setLoadError(data.error)
          return
        }
        setAnalyticsData((previous) => ({ ...previous, ...data }))
        setLoadedReports((previous) => markAnalyticsReportLoaded(
          commitQuery ? createUnloadedReports() : previous,
          report,
        ))
        if (commitQuery) setQuery(nextQuery)
        if (updateHistory) syncUrl(report, nextQuery)
        retryRequestRef.current = null
      } catch {
        if (requestId !== latestRequestRef.current) return
        const offline = typeof navigator !== 'undefined' && !navigator.onLine
        setLoadError(offline
          ? 'Çevrimdışısınız. Mevcut rapor korunuyor; bağlantı gelince yeniden denenecek.'
          : 'Rapor sunucusuna ulaşılamadı. Mevcut rapor korundu; tekrar deneyin.')
      }
    })
  }, [query, restaurantId, syncUrl])

  useEffect(() => {
    const retryOnReconnect = () => {
      const request = retryRequestRef.current
      if (request) loadReport(request.report, request.query, request.commitQuery)
    }
    window.addEventListener('online', retryOnReconnect)
    return () => window.removeEventListener('online', retryOnReconnect)
  }, [loadReport])

  useEffect(() => {
    if (initialReportLoadRef.current) return
    initialReportLoadRef.current = true
    if (!loadedReports[activeReport]) loadReport(activeReport, query, false, false)
  }, [activeReport, loadReport, loadedReports, query])

  useEffect(() => {
    if (initialUrlSyncRef.current) return
    initialUrlSyncRef.current = true
    // The server already allow-lists both values. Replace the entry once so
    // invalid, unavailable and default-only deep links cannot remain stale in
    // the address bar after the UI safely falls back.
    syncUrl(initialReport, initialQuery, true)
  }, [initialQuery, initialReport, syncUrl])

  useEffect(() => {
    const handleHistory = () => {
      const params = new URLSearchParams(window.location.search)
      const nextQuery = parseAnalyticsQuery(params)
      const requestedReport = params.get('report') as AnalyticsReportId | null
      let nextReport: AnalyticsReportId = requestedReport && ['sales', 'items', 'tables', 'payments', 'operasyon', 'sadakat'].includes(requestedReport)
        ? requestedReport
        : 'sales'
      if (nextReport === 'operasyon' && !isOwner) nextReport = 'sales'
      if ((nextReport === 'operasyon' || nextReport === 'sadakat') && !hasAdvancedAnalytics) nextReport = 'sales'
      syncUrl(nextReport, nextQuery, true)
      setActiveReport(nextReport)
      if (!analyticsQueryEquals(nextQuery, query)) loadReport(nextReport, nextQuery, true, false)
      else if (!loadedReports[nextReport]) loadReport(nextReport, nextQuery, false, false)
    }
    window.addEventListener('popstate', handleHistory)
    return () => window.removeEventListener('popstate', handleHistory)
  }, [hasAdvancedAnalytics, isOwner, loadReport, loadedReports, query, syncUrl])

  function changeReport(report: AnalyticsReportId) {
    if (report === 'operasyon' && !isOwner) return
    if ((report === 'operasyon' || report === 'sadakat') && !hasAdvancedAnalytics) return
    setActiveReport(report)
    if (!loadedReports[report]) loadReport(report)
    else syncUrl(report, query)
  }

  function changeRange(nextRange: AnalyticsRange) {
    if (nextRange === 'custom' || nextRange === query.range) return
    // The selected range is committed only after its payload succeeds. During
    // transport/offline failures, the last coherent data + label stay visible.
    loadReport(activeReport, { ...query, range: nextRange, from: null, to: null }, true)
  }

  function changeQuery(nextQuery: AnalyticsQuery) {
    if (analyticsQueryEquals(nextQuery, query)) return
    loadReport(activeReport, nextQuery, true)
  }

  const activeReportLoaded = loadedReports[activeReport]
  const canExport = canExportAnalyticsReport(activeReport, loadedReports, analyticsData)

  return {
    activeReport,
    range: query.range,
    query,
    analyticsData,
    isPending,
    loadError,
    activeReportLoaded,
    canExport,
    changeReport,
    changeRange,
    changeQuery,
    retry: () => {
      const request = retryRequestRef.current
      if (request) loadReport(request.report, request.query, request.commitQuery)
      else loadReport(activeReport)
    },
  }
}
