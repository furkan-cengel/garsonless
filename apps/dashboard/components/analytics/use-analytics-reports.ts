'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { fetchAnalyticsReportPayload } from './analytics-report-client'
import { AnalyticsReportController, type ReportControllerOptions } from './analytics-report-controller'
import { analyticsReportUrl } from './analytics-report-navigation'
import { parseAnalyticsQuery, type AnalyticsRange } from '../../lib/analytics-filter-contract'
import type { AnalyticsReportId } from '../../lib/actions/analytics'

type Options = Omit<ReportControllerOptions, 'fetch' | 'navigate' | 'now'>

export function useAnalyticsReports(options: Options) {
  const [controller] = useState(() => new AnalyticsReportController({
    ...options, fetch: fetchAnalyticsReportPayload,
    navigate: (report, query, { replace, resetTable }) => {
      const url = analyticsReportUrl(window.location.pathname, window.location.search, report, query, resetTable)
      if (`${window.location.pathname}${window.location.search}` !== url) {
        window.history[replace ? 'replaceState' : 'pushState'](null, '', url)
      }
    },
  }))
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
  const restaurantId = options.restaurantId

  useEffect(() => {
    controller.start()
    const online = () => controller.setOffline(false)
    const offline = () => controller.setOffline(true)
    const visible = () => { if (document.visibilityState === 'visible') controller.visible() }
    const history = () => {
      const params = new URLSearchParams(window.location.search)
      controller.changeReport((params.get('report') ?? 'sales') as AnalyticsReportId, parseAnalyticsQuery(params), true)
    }
    if (!navigator.onLine) offline()
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    window.addEventListener('popstate', history)
    document.addEventListener('visibilitychange', visible)
    const timer = window.setInterval(visible, 60_000)
    return () => {
      controller.cancel()
      window.clearInterval(timer)
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offline)
      window.removeEventListener('popstate', history)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [controller])

  useEffect(() => {
    let disposed = false
    let removeChannel: (() => void) | null = null
    const subscribe = async () => {
      const { createDashboardBrowserClient } = await import('../../lib/supabase')
      if (disposed) return
      const supabase = createDashboardBrowserClient()
      const channel = supabase.channel(`analytics:${restaurantId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pano_invalidations', filter: `restaurant_id=eq.${restaurantId}` }, controller.markStale)
        .subscribe((status) => { if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') controller.markStale() })
      removeChannel = () => { void supabase.removeChannel(channel) }
    }
    void subscribe().catch(() => { if (!disposed) controller.markStale() })
    return () => { disposed = true; removeChannel?.() }
  }, [controller, restaurantId])

  return {
    ...state, range: state.query.range,
    changeReport: (report: AnalyticsReportId) => controller.changeReport(report),
    changeRange: (range: AnalyticsRange) => {
      if (range !== 'custom') controller.changeQuery({ ...state.query, range, from: null, to: null })
    },
    changeQuery: controller.changeQuery, refresh: controller.refresh, retry: controller.retry,
  }
}
