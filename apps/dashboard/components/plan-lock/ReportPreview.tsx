'use client'

import { AnalyticsCard, AnalyticsKpi } from '../analytics/AnalyticsReportPrimitives'
import SalesLineChart from '../analytics/chart-primitives/SalesLineChart'

// Deliberately synthetic data; no authenticated or production data is read.
const data = [
  { date: '2 Eyl', current: 11280, prev: 10420 },
  { date: '3 Eyl', current: 14620, prev: 12340 },
  { date: '4 Eyl', current: 12840, prev: 11980 },
  { date: '5 Eyl', current: 17260, prev: 14060 },
  { date: '6 Eyl', current: 18940, prev: 16120 },
  { date: '7 Eyl', current: 13620, prev: 13080 },
  { date: '8 Eyl', current: 14280, prev: 11960 },
]
const revenue = data.reduce((sum, row) => sum + row.current, 0)
const previous = data.reduce((sum, row) => sum + row.prev, 0)
const money = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })
export default function ReportPreview() {
  return <main style={{ padding: 24 }}>
    <div style={{ marginBottom: 22 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0, color: 'var(--text)' }}>Satış Raporu</h1>
      <p style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4, marginBottom: 0 }}>Son 7 gün · Önceki 7 güne göre</p>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
      <AnalyticsKpi label="Son 7 gün tahsilatı" value={money.format(revenue)} delta={`+${((revenue / previous - 1) * 100).toFixed(1)}%`} down={false} hint="Önceki 7 güne göre" />
      <AnalyticsKpi label="Son 7 gün sipariş hacmi" value="1.286" delta="+8.2%" down={false} hint="Önceki 7 güne göre" />
    </div>
    <AnalyticsCard title="Tahsilat trendi" subtitle="Seçili dönem · paid_at bazlı" style={{ overflow: 'visible' }}>
      <SalesLineChart data={data} range="week" />
    </AnalyticsCard>
  </main>
}
