'use client'

import type { ReactNode } from 'react'
import type { AnalyticsReportId } from '../../lib/actions/analytics'
import PageTopBar from '../layout/PageTopBar'
import { I } from '../../lib/ui'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '../ui/alert'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '../ui/empty'
import { Spinner } from '../ui/spinner'
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs'
import {
  ANALYTICS_REPORTS,
  analyticsRangeLabel,
  getVisibleAnalyticsReports,
  type AnalyticsRange,
  type AnalyticsQuery,
} from './analytics-report-model'
import AnalyticsFilterBar from './AnalyticsFilterBar'
import AnalyticsRangePicker from './AnalyticsRangePicker'

const REPORT_ICONS: Record<AnalyticsReportId, ReactNode> = {
  sales: <I.chart size={15} />,
  items: <I.cutlery size={15} />,
  tables: <I.chair size={15} />,
  payments: <I.card size={15} />,
  operasyon: <I.warn size={15} />,
  sadakat: <I.star size={15} />,
}

export function AnalyticsReportShell({
  restaurantName,
  activeReport,
  range,
  query,
  isOwner,
  hasAdvancedAnalytics,
  isPending,
  activeReportLoaded,
  canExport,
  loadError,
  onReportChange,
  onRangeChange,
  onQueryChange,
  onRetry,
  onExport,
  children,
}: {
  restaurantName: string
  activeReport: AnalyticsReportId
  range: AnalyticsRange
  query: AnalyticsQuery
  isOwner: boolean
  hasAdvancedAnalytics: boolean
  isPending: boolean
  activeReportLoaded: boolean
  canExport: boolean
  loadError: string | null
  onReportChange: (report: AnalyticsReportId) => void
  onRangeChange: (range: AnalyticsRange) => void
  onQueryChange: (query: AnalyticsQuery) => void
  onRetry: () => void
  onExport: () => void
  children: ReactNode
}) {
  const visibleReports = getVisibleAnalyticsReports(isOwner, hasAdvancedAnalytics)
  const activeLabel = ANALYTICS_REPORTS.find((report) => report.id === activeReport)?.label ?? 'Raporlar'

  return (
    <div className="analytics-shell" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageTopBar
        className="page-topbar--analytics"
        restaurantName={restaurantName}
        title="Raporlar"
        right={(
          <>
            <AnalyticsRangePicker query={query} onRangeChange={onRangeChange} onQueryChange={onQueryChange} loading={isPending} />
            <Button
              className="analytics-export-button"
              type="button"
              onClick={onExport}
              disabled={!canExport}
              size="sm"
            >
              <I.download data-icon="inline-start" /><span className="analytics-export-label">Dışa aktar</span>
            </Button>
          </>
        )}
      />
      <div className="analytics-body" style={{ display: 'flex', flex: 1, minHeight: 0, background: 'var(--bg)' }}>
        <aside className="analytics-sidebar" style={{
          width: 220,
          flexShrink: 0,
          borderRight: '1px solid var(--border)',
          background: 'var(--surface)',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--divider)' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Raporlar</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 3 }}>
              {analyticsRangeLabel(range)} · gerçek veri
            </div>
          </div>
          <Tabs value={activeReport} onValueChange={(value) => onReportChange(value as AnalyticsReportId)} orientation="vertical" className="min-h-0 flex-1 gap-0">
            <TabsList variant="line" aria-label="Rapor türleri" className="analytics-desktop-report-tabs h-full w-full items-stretch justify-start overflow-y-auto p-2">
              {visibleReports.map((report) => (
                <TabsTrigger
                  key={report.id}
                  value={report.id}
                  aria-current={activeReport === report.id ? 'page' : undefined}
                  className="analytics-report-tab h-auto w-full flex-none justify-start px-2 py-2 text-left"
                >
                  <span aria-hidden="true" className="inline-flex w-5 justify-center">{REPORT_ICONS[report.id]}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 font-medium text-foreground">
                      {report.label}
                      {report.badge && <Badge variant="secondary" className="text-[9px] uppercase">{report.badge}</Badge>}
                    </span>
                    <span className="block truncate text-[11px] font-normal text-muted-foreground">{report.desc}</span>
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </aside>

        <div className="analytics-mobile-navigation">
          <div className="analytics-mobile-navigation-heading">
            <span>Raporlar</span>
            <span>{analyticsRangeLabel(range)} · gerçek veri</span>
          </div>
          <Tabs value={activeReport} onValueChange={(value) => onReportChange(value as AnalyticsReportId)}>
            <TabsList variant="line" aria-label="Rapor türleri" className="analytics-mobile-report-tabs">
              {visibleReports.map((report) => (
                <TabsTrigger
                  className="analytics-report-tab analytics-report-tab--compact"
                  key={report.id}
                  value={report.id}
                  aria-current={activeReport === report.id ? 'page' : undefined}
                >
                  <span aria-hidden="true">{REPORT_ICONS[report.id]}</span>
                  <span>{report.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <section className="analytics-main" aria-label={`${activeLabel} raporu`} aria-busy={isPending} style={{ flex: 1, overflow: 'auto', minWidth: 0, opacity: isPending ? 0.6 : 1 }}>
          <AnalyticsFilterBar
            restaurantName={restaurantName}
            query={query}
            disabled={isPending}
            dateOnly={activeReport === 'sadakat'}
            scopeNote={activeReport === 'tables'
              ? 'İşlem filtreleri tahsilat ve siparişe uygulanır; devir/süre fiziksel oturum kapsamıdır.'
              : activeReport === 'operasyon'
                ? 'İşlem filtreleri iptal ve personel tahsilatına uygulanır; anormal kapatma oturum kapsamıdır.'
                : undefined}
            onChange={onQueryChange}
          />
          <div className="analytics-content" style={{ padding: '24px 28px 60px' }}>
            <div className="analytics-active-label">{activeLabel}</div>
            {loadError && (
              <Alert variant="destructive" className="mb-4">
                <I.warn aria-hidden="true" />
                <AlertTitle>Rapor yüklenemedi</AlertTitle>
                <AlertDescription>{loadError}</AlertDescription>
                <AlertAction><Button className="analytics-retry-button" type="button" variant="outline" size="xs" onClick={onRetry} disabled={isPending}>Tekrar dene</Button></AlertAction>
              </Alert>
            )}
            {!activeReportLoaded && isPending ? <AnalyticsReportLoading /> : children}
          </div>
        </section>
      </div>
    </div>
  )
}

function AnalyticsReportLoading() {
  return (
    <Empty role="status" aria-live="polite" className="min-h-80">
      <EmptyHeader>
        <EmptyMedia variant="icon"><Spinner /></EmptyMedia>
        <EmptyTitle>Rapor yükleniyor</EmptyTitle>
        <EmptyDescription>Seçili dönem için veriler hazırlanıyor.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
