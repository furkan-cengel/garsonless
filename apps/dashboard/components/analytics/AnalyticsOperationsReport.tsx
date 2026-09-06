'use client'

import dynamic from 'next/dynamic'
import type { CSSProperties } from 'react'
import type {
  AbnormalCloseReport,
  CancellationReport,
  StaffSettlementReport,
  StaffSettlementRow,
  TopItem,
} from '../../lib/queries/analytics'
import { formatCurrency } from '../../lib/utils'
import { AnalyticsCard as Card, AnalyticsKpi as KPISmall } from './AnalyticsReportPrimitives'
import { loadAnalyticsChart } from './chart-primitives/load-analytics-chart'
import {
  analyticsPreviousPeriodLabel as previousPeriodLabel,
  analyticsRangePeriodLabel as rangePeriodLabel,
  formatAnalyticsReportDate as formatReportDate,
} from './analytics-report-model'
import {
  compactCancellationTrend,
  projectOperationDelta,
  sumStaffMethod,
} from './analytics-operations-model'
import type { AnalyticsQuery } from '../../lib/analytics-filter-contract'

const chartLoading = (height: number) => () => (
  <div role="status" aria-live="polite" style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-4)', fontSize: 12 }}>Grafik yükleniyor…</div>
)
const CancellationTrendChart = dynamic(() => loadAnalyticsChart(() => import('./chart-primitives/CancellationTrendChart')), { ssr: false, loading: chartLoading(148) })
const s = { mono: { fontFamily: "'Geist Mono', ui-monospace, monospace" } as CSSProperties }


/* ── OPERATIONS REPORT ────────────────────────────── */
export function AnalyticsOperationsReport({
  cancellations,
  abnormalCloses,
  staffSettlement,
  query,
}: {
  cancellations: CancellationReport
  abnormalCloses: AbnormalCloseReport
  staffSettlement: StaffSettlementReport
  query: AnalyticsQuery
}) {
  return (
    <div style={{ maxWidth: 1140, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--text)' }}>Operasyon</h1>
        <p style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4, marginBottom: 0 }}>
          Para ve personel kaçağı denetimi · {rangePeriodLabel(query)}
        </p>
      </div>

      <SectionLabel number="1" title="İptal raporu" subtitle="Tahsil edilmemiş ve tahsilat işaretli iptaller" />
      <div className="analytics-responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginBottom: 12 }}>
        <OperationKPI label="İptal sayısı" value={String(cancellations.count)} change={cancellations.deltaCount} hint={previousPeriodLabel(query)} />
        <OperationKPI label="Tahsil edilmemiş" value={formatCurrency(cancellations.lostAmount)} change={cancellations.deltaLost} hint={previousPeriodLabel(query)} />
        <KPISmall
          label="Tahsilat işaretli iptal"
          value={formatCurrency(cancellations.collectedCancelledAmount)}
          delta={`${cancellations.collectedCancelledCount} sipariş`}
          tone="neutral"
          direction="flat"
          hint="iade durumu ayrı izlenmeli"
        />
        <OperationKPI label="İptal oranı" value={`%${cancellations.rate.toLocaleString('tr-TR')}`} change={cancellations.deltaRate} suffix="puan" hint="sipariş içinde" />
      </div>
      {cancellations.count === 0 ? (
        <EmptyReportState text="Bu dönemde iptal yok" />
      ) : (
        <div className="analytics-responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, marginBottom: 20 }}>
          <Card title="En çok iptal edilen ürünler" subtitle="Adet ve sipariş anındaki net tutar">
            <CancelledItemsTable items={cancellations.topItems} />
          </Card>
          <Card title="Dönem içi iptal trendi" subtitle={`${rangePeriodLabel(query)} · adet`} style={{ overflow: 'visible' }}>
            <CancellationTrend data={cancellations.trend} range={query.range} />
          </Card>
        </div>
      )}

      <SectionLabel number="2" title="Anormal kapatma / kaçak" subtitle="Ödenmeden kapanan adisyonlar" />
      <div className="analytics-responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginBottom: 12 }}>
        <OperationKPI label="Anormal kapatma" value={String(abnormalCloses.count)} change={abnormalCloses.deltaCount} hint={previousPeriodLabel(query)} />
        <OperationKPI label="Ödenmeden kalan" value={formatCurrency(abnormalCloses.unpaidTotal)} change={abnormalCloses.deltaUnpaid} hint="tahsil edilemedi" />
      </div>
      <Card title="Kaçak dökümü" subtitle="Masa · zaman · kapatan · gerekçe" style={{ marginBottom: 20 }}>
        <AbnormalCloseTable report={abnormalCloses} />
      </Card>

      <SectionLabel number="3" title="Personel tahsilat performansı" subtitle="Kasa denetimi · kim ne kadar tahsil etti" />
      <div className="analytics-responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginBottom: 12 }}>
        <KPISmall label="Personel nakit" value={formatCurrency(sumStaffMethod(staffSettlement.rows, 'cash'))} delta="elden tahsilat" tone="neutral" direction="flat" />
        <KPISmall label="Personel kart" value={formatCurrency(sumStaffMethod(staffSettlement.rows, 'pos'))} delta="fiziksel POS" tone="neutral" direction="flat" />
        <KPISmall label="Tahsil eden kaydı yok" value={formatCurrency(staffSettlement.rows.find((row) => row.role === 'system')?.collected ?? 0)} delta="tüm ödeme yöntemleri" tone="neutral" direction="flat" />
      </div>
      <Card title="Tahsilat kırılımı" subtitle="Nakit vs fiziksel POS · tahsil eden başına">
        <StaffSettlementTable report={staffSettlement} />
      </Card>
    </div>
  )
}

function SectionLabel({ number, title, subtitle }: { number: string; title: string; subtitle: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 12px' }}>
      <span style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--surface-inset)', color: 'var(--text-2)', ...s.mono, fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{number}</span>
      <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{title}</span>
      <span style={{ fontSize: 12, color: 'var(--text-3)' }}>· {subtitle}</span>
    </div>
  )
}

function OperationKPI({
  label,
  value,
  change,
  suffix = '%',
  hint,
}: {
  label: string
  value: string
  change: number | null
  suffix?: string
  hint?: string
}) {
  const { direction, tone, text } = projectOperationDelta(change, suffix)
  return <KPISmall label={label} value={value} delta={text} direction={direction} tone={tone} hint={hint} />
}

function EmptyReportState({ text }: { text: string }) {
  return (
    <div style={{
      padding: '30px 16px',
      marginBottom: 24,
      textAlign: 'center',
      color: 'var(--text-3)',
      fontSize: 13,
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 10,
    }}>
      {text}
    </div>
  )
}

// Thin wrapper: keep the compaction here, render the recharts bar (HOVER tier).
function CancellationTrend({ data, range }: { data: CancellationReport['trend']; range: string }) {
  const compact = compactCancellationTrend(data, range)
  return (
    <div style={{ padding: '12px 12px 8px' }}>
      <CancellationTrendChart data={compact} />
    </div>
  )
}

function CancelledItemsTable({ items }: { items: TopItem[] }) {
  if (items.length === 0) {
    return <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>İptal kalemi yok</div>
  }
  return (
    <div>
      {items.map((item) => {
        const maxCount = Math.max(...items.map((entry) => entry.count), 1)
        return (
          <div key={item.name} style={{ padding: '10px 16px', borderBottom: '1px solid var(--divider)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{item.count} iptal</span>
              <span style={{ ...s.mono, fontSize: 12.5, fontWeight: 600, minWidth: 86, textAlign: 'right', color: 'var(--text)' }}>{formatCurrency(item.revenue)}</span>
            </div>
            <div style={{ height: 6, background: 'var(--surface-3)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${(item.count / maxCount) * 100}%`, height: '100%', background: 'var(--critical)', borderRadius: 3 }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function AbnormalCloseTable({ report }: { report: AbnormalCloseReport }) {
  if (report.rows.length === 0) {
    return <div style={{ padding: '38px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>Bu dönemde anormal kapatma yok</div>
  }
  return (
    <div className="analytics-table-scroll" role="region" aria-label="Oturum operasyon detayları" tabIndex={0} style={{ overflowX: 'auto' }}>
      <div style={{ minWidth: 720 }}>
        <ReportTableHeader columns="110px 150px minmax(220px, 1fr) 130px 110px" labels={['Masa', 'Kapatılma', 'Gerekçe', 'Kapatan', 'Tutar']} />
        {report.rows.map((row, index) => (
          <div key={`${row.closedAt}-${row.tableLabel}-${index}`} style={{ display: 'grid', gridTemplateColumns: '110px 150px minmax(220px, 1fr) 130px 110px', gap: 12, alignItems: 'center', padding: '11px 14px', borderBottom: index === report.rows.length - 1 ? 'none' : '1px solid var(--divider)' }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>{row.tableLabel}</span>
            <span style={{ ...s.mono, fontSize: 10.5, color: 'var(--text-3)' }}>{formatReportDate(row.closedAt)}</span>
            <span style={{ fontSize: 12, color: 'var(--text-2)', overflowWrap: 'anywhere' }}>{row.reason}</span>
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>—</span>
            <span style={{ ...s.mono, fontSize: 12, fontWeight: 700, color: 'var(--critical)', textAlign: 'right' }}>{formatCurrency(row.amount)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function StaffSettlementTable({ report }: { report: StaffSettlementReport }) {
  if (report.rows.length === 0) {
    return <div style={{ padding: '38px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>Bu dönemde tahsilat yok</div>
  }
  return (
    <div className="analytics-table-scroll" role="region" aria-label="Sipariş operasyon detayları" tabIndex={0} style={{ overflowX: 'auto' }}>
      <div style={{ minWidth: 1080 }}>
        <ReportTableHeader columns="minmax(200px, 1.3fr) 76px 100px 100px 100px 100px 110px minmax(140px, 1fr)" labels={['Tahsil eden', 'Sipariş', 'Nakit', 'Fiziksel POS', 'Online / split / eski', 'İkram', 'Toplam', 'Dağılım']} />
        {report.rows.map((row, index) => {
          const paymentBase = row.cash + row.pos + row.otherCollected
          const cashPct = paymentBase > 0 ? (row.cash / paymentBase) * 100 : 0
          const posPct = paymentBase > 0 ? (row.pos / paymentBase) * 100 : 0
          const otherPct = paymentBase > 0 ? (row.otherCollected / paymentBase) * 100 : 0
          return (
          <div key={`${row.role}-${row.label}-${index}`} style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(200px, 1.3fr) 76px 100px 100px 100px 100px 110px minmax(140px, 1fr)',
            gap: 12,
            alignItems: 'center',
            padding: '11px 14px',
            borderBottom: index === report.rows.length - 1 ? 'none' : '1px solid var(--divider)',
            borderTop: row.role === 'system' ? '2px solid var(--border)' : 'none',
            background: row.role === 'system' ? 'var(--surface-2)' : 'transparent',
          }}>
            <StaffIdentity row={row} />
            <span aria-label={`${row.settledCount} tahsilat`} style={{ ...s.mono, fontSize: 11.5, textAlign: 'right', color: 'var(--text-2)' }}>{row.settledCount}</span>
            <SettlementAmount amount={row.cash} warning />
            <SettlementAmount amount={row.pos} />
            <SettlementAmount amount={row.otherCollected} />
            <span style={{ ...s.mono, fontSize: 11.5, textAlign: 'right', color: 'var(--text-2)' }}>{row.compCount ? `${row.compCount} · ${formatCurrency(row.compAmount)}` : '—'}</span>
            <span style={{ ...s.mono, fontSize: 12, fontWeight: 700, textAlign: 'right', color: 'var(--text)' }}>{formatCurrency(row.collected)}</span>
            <div>
              <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: 'var(--surface-3)' }}>
                {cashPct > 0 && <div title="Nakit" style={{ width: `${cashPct}%`, background: 'var(--warning)' }} />}
                {posPct > 0 && <div title="Fiziksel POS" style={{ width: `${posPct}%`, background: 'var(--text)' }} />}
                {otherPct > 0 && <div title="Online / eski" style={{ width: `${otherPct}%`, background: 'var(--info)' }} />}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 3 }}>
                {paymentBase === 0 ? 'tahsilat dışı' : cashPct > 0 ? `%${Math.round(cashPct)} nakit` : row.role === 'system' ? 'tamamı otomatik' : 'nakit yok'}
              </div>
            </div>
          </div>
          )
        })}
      </div>
    </div>
  )
}

function StaffIdentity({ row }: { row: StaffSettlementRow }) {
  const roleLabel = row.role === 'owner' ? 'Sahip' : row.role === 'member' ? 'Üye' : row.role === 'system' ? 'Sistem' : 'Kayıt bulunamadı'
  const detail = row.role === 'member' && row.sections?.length ? `${roleLabel} · ${row.sections.join(', ')}` : roleLabel
  const initials = row.role === 'system'
    ? 'SYS'
    : row.label.split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
      <div style={{ width: 30, height: 30, flexShrink: 0, borderRadius: row.role === 'system' ? 7 : '50%', background: 'var(--surface-inset)', color: row.role === 'system' ? 'var(--info)' : 'var(--text-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', ...s.mono, fontSize: row.role === 'system' ? 9 : 10, fontWeight: 700 }}>{initials || '—'}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.label}</span>
          {row.highCash && <span title="Nakit oranı %80 veya üzeri" style={{ padding: '2px 6px', borderRadius: 999, background: 'var(--warning-bg)', color: 'var(--warning)', fontSize: 9.5, fontWeight: 650, whiteSpace: 'nowrap' }}>yüksek nakit</span>}
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{detail}</div>
      </div>
    </div>
  )
}

function SettlementAmount({ amount, warning }: { amount: number; warning?: boolean }) {
  return (
    <span style={{ ...s.mono, fontSize: 11.5, fontWeight: amount > 0 ? 600 : 400, textAlign: 'right', color: amount > 0 && warning ? 'var(--warning)' : amount > 0 ? 'var(--text-2)' : 'var(--text-4)' }}>
      {amount > 0 ? formatCurrency(amount) : '—'}
    </span>
  )
}

function ReportTableHeader({ columns, labels }: { columns: string; labels: string[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: columns, gap: 12, padding: '8px 14px', background: 'var(--surface-2)', borderBottom: '1px solid var(--divider)' }}>
      {labels.map((label, index) => (
        <span key={label} style={{ fontSize: 10.5, color: 'var(--text-3)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.05em', textAlign: index === 0 || label === 'Kapatılma' || label === 'Gerekçe' || label === 'Kapatan' || label === 'Dağılım' ? 'left' : 'right' }}>{label}</span>
      ))}
    </div>
  )
}
