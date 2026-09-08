import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Skeleton } from '../ui/skeleton'
import type { AnalyticsReportId } from '../../lib/actions/analytics'
import { ANALYTICS_REPORTS } from './analytics-report-model'

export function AnalyticsReportLoading({ report = 'sales' }: { report?: AnalyticsReportId }) {
  return (
    <div className="analytics-report-loading" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{ANALYTICS_REPORTS.find((item) => item.id === report)?.label ?? 'Rapor'} yükleniyor.</span>
      <div aria-hidden="true" className="analytics-report-loading-visual">
        <div className="analytics-loading-kpis analytics-responsive-grid">
          {Array.from({ length: 4 }, (_, index) => (
            <Card key={index} size="sm">
              <CardHeader className="gap-1">
                <CardDescription className="text-[11px] font-medium uppercase tracking-[0.05em]"><Skeleton className="h-[1lh] w-28 max-w-full" /></CardDescription>
                <CardTitle className="text-2xl font-bold tracking-tight tabular-nums"><Skeleton className="h-[1lh] w-24 max-w-full" /></CardTitle>
              </CardHeader>
              <CardContent className="flex min-h-5 items-center gap-1.5">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-3 w-24 max-w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="analytics-loading-panels analytics-responsive-grid">
          {[0, 1].map((index) => (
            <Card key={index} size="sm" className="gap-0 py-0">
              <CardHeader className="border-b py-3"><Skeleton className="h-5 w-36 max-w-full" /></CardHeader>
              <CardContent className="p-3"><Skeleton className="h-56 w-full" /></CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
