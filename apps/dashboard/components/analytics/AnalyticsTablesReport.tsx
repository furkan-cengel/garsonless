'use client'

import type { CSSProperties } from 'react'
import type { TableReportRow } from '../../lib/queries/analytics'
import { formatCurrency } from '../../lib/utils'
import { AnalyticsCard as Card, AnalyticsKpi as KPISmall } from './AnalyticsReportPrimitives'
import { analyticsRangePeriodLabel as rangePeriodLabel } from './analytics-report-model'
import { formatTableDwell, projectTablesReport } from './analytics-tables-model'
import type { AnalyticsQuery } from '../../lib/analytics-filter-contract'

const s = { mono: { fontFamily: "'Geist Mono', ui-monospace, monospace" } as CSSProperties }

export function AnalyticsTablesReport({ tables, query }: { tables: TableReportRow[]; query: AnalyticsQuery }) {
  if (tables.length === 0) {
    return (
      <div style={{ maxWidth: 1140 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0, color: 'var(--text)' }}>Masa Performansı</h1>
        <p style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4, marginBottom: 22 }}>{rangePeriodLabel(query)} · tahsilat</p>
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>Henüz masa verisi yok</div>
      </div>
    )
  }

  const report = projectTablesReport(tables)

  return (
    <div style={{ maxWidth: 1140 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0, color: 'var(--text)' }}>Masa Performansı</h1>
      <p style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4, marginBottom: 22 }}>
        {tables.length} masa · {rangePeriodLabel(query)} · devir ve tahsilat
      </p>

      <div className="analytics-responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
        <KPISmall label="Tahsilat yapılan masa" value={String(report.activeTables)} delta={report.openNowCount > 0 ? `${report.openNowCount} şu an dolu` : '-'} tone="neutral" direction="flat" />
        <KPISmall label="Ödemeli sipariş" value={String(report.totalOrders)} delta="-" />
        <KPISmall label="Toplam tahsilat" value={formatCurrency(report.totalRevenue)} delta="-" />
        <KPISmall label="Ort. masa tahsilatı"
          value={report.averageRevenue === null ? '-' : formatCurrency(report.averageRevenue)}
          delta="-"
        />
        <KPISmall label="Devir (kapanan oturum)" value={String(report.totalTurnover)} delta="açık oturumlar sayılmaz" tone="neutral" direction="flat" />
        <KPISmall label="Ort. oturum süresi" value={formatTableDwell(report.overallDwell)} delta="kapanan oturumlardan" tone="neutral" direction="flat" />
      </div>

      <Card title="Masa tahsilatı ve devri" subtitle={`${rangePeriodLabel(query)} · masa başı tahsilat, devir ve ortalama oturum süresi`} style={{ marginBottom: 12 }}>
        <div className="analytics-table-scroll" role="region" aria-label="Masa tahsilatı ve devir karşılaştırması" tabIndex={0} style={{ padding: 14 }}>
          <div style={{ minWidth: 590 }}>
          {report.sortedTables.map((t, i) => {
            const pct = (t.revenue / report.maxRevenue) * 100
            return (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                <span style={{ fontSize: 11, fontWeight: 700, width: 52, ...s.mono, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  {t.label}
                  {t.openNow && <span title="Şu an dolu" style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--positive)', flexShrink: 0 }} />}
                </span>
                <div style={{ flex: 1, position: 'relative', height: 18, background: 'var(--surface-3)', borderRadius: 9, overflow: 'hidden' }}>
                  <div style={{
                    position: 'absolute', left: 0, top: 0, bottom: 0, width: pct + '%',
                    background: i === 0 ? '#ffd089' : i < 3 ? 'var(--positive)' : i < 8 ? 'var(--info)' : 'var(--text-3)',
                    borderRadius: 9,
                  }} />
                </div>
                <span style={{ ...s.mono, fontSize: 11.5, fontWeight: 600, minWidth: 60, textAlign: 'right' }}>
                  {t.revenue > 0 ? formatCurrency(t.revenue) : '-'}
                </span>
                <span style={{ ...s.mono, fontSize: 11, color: 'var(--text-3)', minWidth: 54, textAlign: 'right' }}>
                  {t.orders} ödeme
                </span>
                <span style={{ ...s.mono, fontSize: 11, color: 'var(--text-3)', minWidth: 50, textAlign: 'right' }}>
                  {t.turnover} devir
                </span>
                <span style={{ ...s.mono, fontSize: 11, color: 'var(--text-2)', minWidth: 64, textAlign: 'right' }}>
                  {formatTableDwell(t.avgDwellMinutes)}
                </span>
              </div>
            )
          })}
          </div>
        </div>
      </Card>
    </div>
  )
}
