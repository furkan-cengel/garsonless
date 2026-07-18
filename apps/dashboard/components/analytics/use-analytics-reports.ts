'use client'

import { useRef, useState, useTransition } from 'react'
import { fetchAnalyticsReportData, type AnalyticsReportId } from '../../lib/actions/analytics'
import {
  canExportAnalyticsReport,
  createInitialAnalyticsData,
  createInitialLoadedReports,
  createUnloadedReports,
  markAnalyticsReportLoaded,
  type AnalyticsInitialData,
  type AnalyticsRange,
} from './analytics-report-model'

export function useAnalyticsReports({
  restaurantId,
  initialData,
  isOwner,
}: {
  restaurantId: string
  initialData: AnalyticsInitialData
  isOwner: boolean
}) {
  const [activeReport, setActiveReport] = useState<AnalyticsReportId>('sales')
  const [range, setRange] = useState<AnalyticsRange>('week')
  const [analyticsData, setAnalyticsData] = useState(() => createInitialAnalyticsData(initialData))
  const [loadedReports, setLoadedReports] = useState(() => createInitialLoadedReports(initialData))
  const [isPending, startTransition] = useTransition()
  const [loadError, setLoadError] = useState<string | null>(null)
  const latestRequestRef = useRef(0)

  function loadReport(report: AnalyticsReportId, nextRange: AnalyticsRange = range) {
    const requestId = ++latestRequestRef.current
    startTransition(async () => {
      setLoadError(null)
      const data = await fetchAnalyticsReportData(restaurantId, nextRange, report)
      if (requestId !== latestRequestRef.current) return
      if (data.error) {
        setLoadError(data.error)
        return
      }
      setAnalyticsData((previous) => ({ ...previous, ...data }))
      setLoadedReports((previous) => markAnalyticsReportLoaded(previous, report))
    })
  }

  function changeReport(report: AnalyticsReportId) {
    if (report === 'operasyon' && !isOwner) return
    setActiveReport(report)
    if (!loadedReports[report]) loadReport(report)
  }

  function changeRange(nextRange: AnalyticsRange) {
    setRange(nextRange)
    setLoadedReports(createUnloadedReports())
    loadReport(activeReport, nextRange)
  }

  const activeReportLoaded = loadedReports[activeReport]
  const canExport = canExportAnalyticsReport(activeReport, loadedReports, analyticsData)

  return {
    activeReport,
    range,
    analyticsData,
    isPending,
    loadError,
    activeReportLoaded,
    canExport,
    changeReport,
    changeRange,
    retry: () => loadReport(activeReport),
  }
}
