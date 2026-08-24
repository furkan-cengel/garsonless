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
  type AnalyticsFreshness,
} from './analytics-report-model'
import { analyticsQueryEquals, analyticsQueryToSearchParams, parseAnalyticsQuery } from '../../lib/analytics-filter-contract'

export function useAnalyticsReports({
  restaurantId,
  initialData,
  isOwner,
  hasAdvancedAnalytics,
  initialQuery,
  initialReport,
  initialGeneratedAt,
  initialSnapshotVersion,
}: {
  restaurantId: string
  initialData: AnalyticsInitialData
  isOwner: boolean
  hasAdvancedAnalytics: boolean
  initialQuery: AnalyticsQuery
  initialReport: AnalyticsReportId
  initialGeneratedAt: string
  initialSnapshotVersion: number
}) {
  const [activeReport, setActiveReport] = useState<AnalyticsReportId>(initialReport)
  const [query, setQuery] = useState<AnalyticsQuery>(initialQuery)
  const [analyticsData, setAnalyticsData] = useState(() => createInitialAnalyticsData(initialData))
  const [loadedReports, setLoadedReports] = useState(() => createInitialLoadedReports(initialData))
  const [isPending, startTransition] = useTransition()
  const [loadError, setLoadError] = useState<string | null>(null)
  const [generatedAt, setGeneratedAt] = useState(initialGeneratedAt)
  const [freshness, setFreshness] = useState<AnalyticsFreshness>('fresh')
  const latestRequestRef = useRef(0)
  const requestControllerRef = useRef<AbortController | null>(null)
  const snapshotVersionRef = useRef(initialSnapshotVersion)
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
    requestControllerRef.current?.abort()
    const controller = new AbortController()
    requestControllerRef.current = controller
    retryRequestRef.current = { report, query: nextQuery, commitQuery }
    setFreshness(typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'refreshing')
    startTransition(async () => {
      setLoadError(null)
      try {
        const response = await fetchAnalyticsReportPayload(restaurantId, nextQuery, report, controller.signal)
        if (requestId !== latestRequestRef.current) return
        if (response.error || !response.data) {
          setLoadError(response.error ?? 'Rapor verileri yüklenemedi.')
          setFreshness(typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'stale')
          return
        }
        setAnalyticsData((previous) => ({ ...previous, ...response.data }))
        setLoadedReports((previous) => markAnalyticsReportLoaded(
          commitQuery ? createUnloadedReports() : previous,
          report,
        ))
        if (commitQuery) setQuery(nextQuery)
        if (updateHistory) syncUrl(report, nextQuery)
        const nextGeneratedAt = response.generatedAt ?? new Date().toISOString()
        setGeneratedAt(nextGeneratedAt)
        snapshotVersionRef.current = response.snapshotVersion ?? new Date(nextGeneratedAt).getTime()
        setFreshness('fresh')
        retryRequestRef.current = null
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        if (requestId !== latestRequestRef.current) return
        const offline = typeof navigator !== 'undefined' && !navigator.onLine
        setFreshness(offline ? 'offline' : 'stale')
        setLoadError(offline
          ? 'Çevrimdışısınız. Mevcut rapor korunuyor; bağlantı gelince yeniden denenecek.'
          : 'Rapor sunucusuna ulaşılamadı. Mevcut rapor korundu; tekrar deneyin.')
      }
    })
  }, [query, restaurantId, syncUrl])

  useEffect(() => {
    const retryOnReconnect = () => {
      setFreshness('stale')
      const request = retryRequestRef.current
      if (request) loadReport(request.report, request.query, request.commitQuery)
    }
    const markOffline = () => setFreshness('offline')
    window.addEventListener('online', retryOnReconnect)
    window.addEventListener('offline', markOffline)
    return () => {
      window.removeEventListener('online', retryOnReconnect)
      window.removeEventListener('offline', markOffline)
    }
  }, [loadReport])

  useEffect(() => {
    let disposed = false
    let removeChannel: (() => void) | null = null
    const subscribe = async () => {
      const { createDashboardBrowserClient } = await import('../../lib/supabase')
      if (disposed) return
      const supabase = createDashboardBrowserClient()
      const channel = supabase
        .channel(`analytics:${restaurantId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'pano_invalidations',
          filter: `restaurant_id=eq.${restaurantId}`,
        }, (payload) => {
          const row = payload.new as { version?: unknown } | null
          if (typeof row?.version === 'number') snapshotVersionRef.current = row.version
          setFreshness((current) => (current === 'offline' ? current : 'stale'))
        })
        .subscribe()
      removeChannel = () => { void supabase.removeChannel(channel) }
    }
    void subscribe()
    return () => {
      disposed = true
      removeChannel?.()
    }
  }, [restaurantId])

  useEffect(() => {
    const reconcileVisibleSnapshot = () => {
      if (document.visibilityState !== 'visible') return
      const age = Date.now() - new Date(generatedAt).getTime()
      if (age >= 5 * 60_000) loadReport(activeReport, query, false, false)
    }
    document.addEventListener('visibilitychange', reconcileVisibleSnapshot)
    return () => document.removeEventListener('visibilitychange', reconcileVisibleSnapshot)
  }, [activeReport, generatedAt, loadReport, query])

  useEffect(() => () => requestControllerRef.current?.abort(), [])

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
    generatedAt,
    freshness,
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
    refresh: () => loadReport(activeReport, query, false, false),
  }
}
