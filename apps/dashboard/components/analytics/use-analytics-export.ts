'use client'

import { useRef, useState } from 'react'
import type { useAnalyticsReports } from './use-analytics-reports'

export function useAnalyticsExport({ reports, restaurantId, restaurantName }: {
  reports: ReturnType<typeof useAnalyticsReports>; restaurantId: string; restaurantName: string
}) {
  const exportLock = useRef(false)
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  async function handleExport() {
    if (!reports.canExport || exportLock.current) return
    exportLock.current = true
    setIsExporting(true)
    setExportError(null)
    try {
      const { buildAnalyticsReportCsv, downloadAnalyticsCsv } = await import('./analytics-report-export')
      const built = buildAnalyticsReportCsv(reports.activeReport, reports.query, reports.analyticsData, {
        restaurantId, restaurantName, generatedAt: reports.generatedAt, scope: reports.scope, freshness: reports.freshness,
      })
      if (!built) throw new Error('Rapor henüz dışa aktarmaya hazır değil.')
      downloadAnalyticsCsv(built.filename, built.csv)
    } catch {
      setExportError('CSV oluşturulamadı. Dışa aktar düğmesiyle tekrar deneyin.')
    } finally { exportLock.current = false; setIsExporting(false) }
  }
  return { handleExport, isExporting, exportError }
}
