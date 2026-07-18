import type { AnalyticsReportId } from '../../lib/actions/analytics'
import type { DashboardKPIs } from '../../lib/queries'
import {
  analyticsRangePeriodLabel,
  formatAnalyticsReportDate,
  type AnalyticsData,
} from './analytics-report-model'

type CsvValue = string | number | null

const EXPORT_SLUGS: Record<AnalyticsReportId, string> = {
  sales: 'satis-raporu',
  items: 'urun-performansi',
  tables: 'masa-performansi',
  payments: 'odeme-raporu',
  operasyon: 'operasyon-raporu',
  sadakat: 'sadakat-raporu',
}

const RANGE_SLUGS: Record<string, string> = {
  day: 'bugun',
  week: '7gun',
  month: '30gun',
  quarter: 'ceyrek',
  year: 'yil',
}

export function escapeAnalyticsCsvCell(value: CsvValue): string {
  if (value === null) return ''
  const raw = String(value)
  // User-controlled names, emails and close reasons must not become formulas
  // when the CSV is opened in Excel or Sheets.
  const safe = /^[\t ]*[=+\-@]/.test(raw) ? `'${raw}` : raw
  return /[",\n\r;]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe
}

function rowsToCsv(rows: CsvValue[][]): string {
  return rows.map((row) => row.map(escapeAnalyticsCsvCell).join(',')).join('\r\n')
}

export function buildAnalyticsReportCsv(
  report: AnalyticsReportId,
  range: string,
  kpis: DashboardKPIs,
  data: AnalyticsData,
): { filename: string; csv: string } | null {
  const period = analyticsRangePeriodLabel(range)
  const rows: CsvValue[][] = []
  const section = (title: string) => {
    if (rows.length > 0) rows.push([])
    rows.push([title])
  }

  if (report === 'sales') {
    section('Satış Raporu — günün özeti (bugün · düne kıyasla)')
    rows.push(['Metrik', 'Değer'])
    rows.push(['Tahsil edilen (₺)', kpis.revenue])
    rows.push(['Sipariş hacmi', kpis.orders])
    rows.push(['Ort. tahsilat (₺)', kpis.avgBasket])
    rows.push(['Oturum', kpis.sessions])
    rows.push(['Aktif sipariş', kpis.activeOrders])
    section(`Tahsilat trendi (${period})`)
    rows.push(['Tarih', 'Dönem (₺)', 'Önceki dönem (₺)'])
    for (const row of data.salesOverTime) rows.push([row.date, row.current, row.prev])
    section(`En çok satan ürünler (${period})`)
    rows.push(['Ürün', 'Adet', 'Tutar (₺)'])
    for (const row of data.topItems) rows.push([row.name, row.count, row.revenue])
    section(`Ödeme dağılımı (${period})`)
    rows.push(['Yöntem', 'Tutar (₺)', 'Adet', 'Pay (%)'])
    for (const row of data.paymentBreakdown.collected) rows.push([row.label, row.amount, row.count, row.pct])
    rows.push(['İkram (tahsilat dışı)', data.paymentBreakdown.comp.amount, data.paymentBreakdown.comp.count, null])
  } else if (report === 'items') {
    section(`Ürün Performansı (${period})`)
    rows.push(['Ürün', 'Adet', 'Tutar (₺)', 'Pay (%)', 'Kümülatif (%)', 'Sınıf', 'Değişim (%)'])
    for (const row of data.productReport) {
      rows.push([row.name, row.count, row.revenue, row.sharePct, row.cumulativePct, row.abcClass, row.deltaPct === null ? 'Yeni' : row.deltaPct])
    }
  } else if (report === 'tables') {
    section(`Masa Performansı (${period})`)
    rows.push(['Masa', 'Tahsilat (₺)', 'Ödemeli sipariş', 'Devir (kapanan oturum)', 'Ort. oturum (dk)', 'Şu an dolu'])
    for (const row of data.tableStats) {
      rows.push([row.label, row.revenue, row.orders, row.turnover, row.avgDwellMinutes, row.openNow ? 'Evet' : 'Hayır'])
    }
  } else if (report === 'payments') {
    section(`Ödeme Raporu (${period})`)
    rows.push(['Yöntem', 'Tutar (₺)', 'Adet', 'Pay (%)'])
    for (const row of data.paymentBreakdown.collected) rows.push([row.label, row.amount, row.count, row.pct])
    rows.push(['Toplam tahsilat', data.paymentBreakdown.collectedTotal, data.paymentBreakdown.collectedCount, null])
    rows.push(['İkram (tahsilat dışı)', data.paymentBreakdown.comp.amount, data.paymentBreakdown.comp.count, null])
  } else if (report === 'operasyon') {
    const { cancellations, abnormalCloses, staffSettlement } = data
    if (!cancellations || !abnormalCloses || !staffSettlement) return null
    section(`İptal Raporu (${period})`)
    rows.push(['Metrik', 'Değer'])
    rows.push(['İptal sayısı', cancellations.count])
    rows.push(['Kayıp (₺)', cancellations.lostAmount])
    rows.push(['İptal oranı (%)', cancellations.rate])
    section('En çok iptal edilen ürünler')
    rows.push(['Ürün', 'İptal adedi', 'Tutar (₺)'])
    for (const row of cancellations.topItems) rows.push([row.name, row.count, row.revenue])
    section(`Anormal kapatma / kaçak (${period})`)
    rows.push(['Masa', 'Kapatılma', 'Gerekçe', 'Kapatan', 'Tutar (₺)'])
    for (const row of abnormalCloses.rows) {
      rows.push([row.tableLabel, formatAnalyticsReportDate(row.closedAt), row.reason, '—', row.amount])
    }
    section(`Personel tahsilat performansı (${period})`)
    rows.push(['Tahsil eden', 'Rol', 'Tahsil ettiği sipariş', 'Nakit (₺)', 'Fiziksel POS (₺)', 'Online / split / eski (₺)', 'İkram adet', 'İkram (₺)', 'Toplam (₺)', 'Yüksek nakit'])
    for (const row of staffSettlement.rows) {
      const role = row.role === 'owner'
        ? 'Sahip'
        : row.role === 'member'
          ? `Üye${row.sections?.length ? ` (${row.sections.join(' · ')})` : ''}`
          : row.role === 'system'
            ? 'Sistem'
            : 'Kayıt bulunamadı'
      rows.push([row.label, role, row.settledCount, row.cash, row.pos, row.otherCollected, row.compCount, row.compAmount, row.collected, row.highCash ? 'Evet' : 'Hayır'])
    }
  } else {
    const loyalty = data.loyalty
    if (!loyalty) return null
    section(`Sadakat Raporu (${period})`)
    rows.push(['Metrik', 'Değer'])
    rows.push(['Kazandırılan puan (hoş geldin dahil)', loyalty.pointsIssued])
    rows.push(['Kullanılan puan', loyalty.pointsRedeemed])
    rows.push(['Kullanım oranı (%)', loyalty.redeemRate])
    rows.push(['Puan iadesi', loyalty.pointsRefunded])
    rows.push(['Damga kazanılan', loyalty.stampsIssued])
    rows.push(['Damga kullanılan', loyalty.stampsRedeemed])
    rows.push(['Damga iadesi', loyalty.stampsRefunded])
    rows.push(['Ziyaret', loyalty.visits])
    rows.push(['Hoş geldin bonusu (üye)', loyalty.welcomeCount])
    rows.push(['Hoş geldin bonusu (puan)', loyalty.welcomePoints])
    rows.push(['İkram (₺ · tahsilat dışı)', loyalty.comp.amount])
    rows.push(['İkram (adet)', loyalty.comp.count])
    section('Kullanımlar (defterdeki ham sebep)')
    rows.push(['Sebep', 'İşlem', 'Puan', 'Damga'])
    for (const row of loyalty.redemptionsByReason) rows.push([row.reason, row.count, row.points, row.stamps])
  }

  return {
    filename: `${EXPORT_SLUGS[report]}-${RANGE_SLUGS[range] ?? range}.csv`,
    csv: rowsToCsv(rows),
  }
}

export function downloadAnalyticsCsv(filename: string, csv: string) {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
