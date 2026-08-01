'use client'

import type { ReactNode } from 'react'
import type { AnalyticsReportId } from '../../lib/actions/analytics'
import PageTopBar from '../layout/PageTopBar'
import { I, btnPrimary } from '../../lib/ui'
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
            <button
              className="analytics-export-button"
              type="button"
              onClick={onExport}
              disabled={!canExport}
              style={{ ...btnPrimary(), opacity: canExport ? 1 : 0.45, cursor: canExport ? 'pointer' : 'not-allowed' }}
            >
              <I.download size={13} /><span className="analytics-export-label">Dışa aktar</span>
            </button>
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
          <nav aria-label="Rapor türleri" style={{ flex: 1, overflow: 'auto', padding: 8 }}>
            {visibleReports.map((report) => {
              const selected = activeReport === report.id
              return (
                <button
                  key={report.id}
                  type="button"
                  onClick={() => onReportChange(report.id)}
                  aria-current={selected ? 'page' : undefined}
                  className="analytics-report-tab"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    width: '100%',
                    padding: '8px 10px',
                    marginBottom: 1,
                    borderRadius: 7,
                    background: selected ? 'var(--surface-inset)' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ width: 18, display: 'inline-flex', justifyContent: 'center', color: selected ? 'var(--text)' : 'var(--text-3)' }}>
                    {REPORT_ICONS[report.id]}
                  </span>
                  <span style={{ flex: 1 }}>
                    <span style={{ fontSize: 13, fontWeight: selected ? 600 : 500, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {report.label}
                      {report.badge && (
                        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--accent)', background: 'var(--accent-soft)', padding: '1px 5px', borderRadius: 4 }}>
                          {report.badge}
                        </span>
                      )}
                    </span>
                    <span style={{ display: 'block', fontSize: 10.5, color: 'var(--text-3)', marginTop: 1 }}>{report.desc}</span>
                  </span>
                </button>
              )
            })}
          </nav>
        </aside>

        <div className="analytics-mobile-navigation">
          <div className="analytics-mobile-navigation-heading">
            <span>Raporlar</span>
            <span>{analyticsRangeLabel(range)} · gerçek veri</span>
          </div>
          <nav aria-label="Rapor türleri" className="analytics-mobile-report-tabs">
            {visibleReports.map((report) => {
              const selected = activeReport === report.id
              return (
                <button
                  className="analytics-report-tab analytics-report-tab--compact"
                  key={report.id}
                  type="button"
                  onClick={() => onReportChange(report.id)}
                  aria-current={selected ? 'page' : undefined}
                >
                  <span aria-hidden="true">{REPORT_ICONS[report.id]}</span>
                  <span>{report.label}</span>
                </button>
              )
            })}
          </nav>
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
              <div role="alert" style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 10, border: '1px solid var(--critical)', background: 'var(--critical-bg)', color: 'var(--critical)', fontSize: 13 }}>
                {loadError}{' '}
                <button type="button" onClick={onRetry} disabled={isPending} style={{ marginLeft: 8, border: 0, background: 'transparent', color: 'inherit', fontWeight: 700, textDecoration: 'underline', cursor: isPending ? 'wait' : 'pointer' }}>
                  Tekrar dene
                </button>
              </div>
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
    <div role="status" aria-live="polite" style={{
      minHeight: 320,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--text-3)',
      fontSize: 13,
    }}>
      Rapor yükleniyor…
    </div>
  )
}
