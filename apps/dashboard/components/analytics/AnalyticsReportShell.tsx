'use client'

import type { ReactNode } from 'react'
import type { AnalyticsReportId } from '../../lib/actions/analytics'
import PageTopBar from '../layout/PageTopBar'
import { I, btnPrimary } from '../../lib/ui'
import {
  ANALYTICS_REPORTS,
  ANALYTICS_RANGES,
  analyticsRangeLabel,
  getVisibleAnalyticsReports,
  type AnalyticsRange,
} from './analytics-report-model'

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
  isOwner,
  isPending,
  activeReportLoaded,
  canExport,
  loadError,
  onReportChange,
  onRangeChange,
  onRetry,
  onExport,
  children,
}: {
  restaurantName: string
  activeReport: AnalyticsReportId
  range: AnalyticsRange
  isOwner: boolean
  isPending: boolean
  activeReportLoaded: boolean
  canExport: boolean
  loadError: string | null
  onReportChange: (report: AnalyticsReportId) => void
  onRangeChange: (range: AnalyticsRange) => void
  onRetry: () => void
  onExport: () => void
  children: ReactNode
}) {
  const visibleReports = getVisibleAnalyticsReports(isOwner)
  const activeLabel = ANALYTICS_REPORTS.find((report) => report.id === activeReport)?.label ?? 'Raporlar'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageTopBar
        restaurantName={restaurantName}
        title="Raporlar"
        right={(
          <>
            <AnalyticsRangePicker value={range} onChange={onRangeChange} loading={isPending} />
            <button
              type="button"
              onClick={onExport}
              disabled={!canExport}
              style={{ ...btnPrimary(), opacity: canExport ? 1 : 0.45, cursor: canExport ? 'pointer' : 'not-allowed' }}
            >
              <I.download size={13} />Dışa aktar
            </button>
          </>
        )}
      />
      <div style={{ display: 'flex', flex: 1, minHeight: 0, background: 'var(--bg)' }}>
        <aside style={{
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

        <main style={{ flex: 1, overflow: 'auto', minWidth: 0, opacity: isPending ? 0.6 : 1, transition: 'opacity 150ms' }}>
          <div style={{ padding: '24px 28px 60px' }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 20px', color: 'var(--text)' }}>{activeLabel}</h2>
            {loadError && (
              <div role="alert" style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 10, border: '1px solid var(--critical)', background: 'var(--critical-bg)', color: 'var(--critical)', fontSize: 13 }}>
                {loadError}{' '}
                <button type="button" onClick={onRetry} style={{ marginLeft: 8, border: 0, background: 'transparent', color: 'inherit', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer' }}>
                  Tekrar dene
                </button>
              </div>
            )}
            {!activeReportLoaded && isPending ? <AnalyticsReportLoading /> : children}
          </div>
        </main>
      </div>
    </div>
  )
}

function AnalyticsRangePicker({
  value,
  onChange,
  loading,
}: {
  value: AnalyticsRange
  onChange: (range: AnalyticsRange) => void
  loading: boolean
}) {
  return (
    <div role="group" aria-label="Rapor dönemi" style={{ display: 'inline-flex', background: 'var(--surface-3)', borderRadius: 7, padding: 2 }}>
      {ANALYTICS_RANGES.map((range) => (
        <button
          key={range.id}
          type="button"
          onClick={() => onChange(range.id)}
          disabled={loading}
          aria-pressed={value === range.id}
          style={{
            padding: '4px 10px',
            fontSize: 11.5,
            fontWeight: 500,
            background: value === range.id ? 'var(--surface)' : 'transparent',
            color: value === range.id ? 'var(--text)' : 'var(--text-2)',
            boxShadow: value === range.id ? 'var(--shadow-1)' : 'none',
            border: 'none',
            borderRadius: 5,
            cursor: loading ? 'default' : 'pointer',
          }}
        >
          {range.label}
        </button>
      ))}
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
