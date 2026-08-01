import type { AnalyticsReportId } from '../../lib/actions/analytics'
import {
  analyticsRangePeriodLabel,
  formatAnalyticsReportDate,
  type AnalyticsData,
} from './analytics-report-model'
import { coerceAnalyticsQuery, type AnalyticsQuery } from '../../lib/analytics-filter-contract'

type CsvValue = string | number | null

const SPREADSHEET_FORMULA_PREFIX = /^[\t \r\n]*[=+\-@＝＋－＠]/u
const SPREADSHEET_CONTROL_PREFIX = /^ *[\t\r\n]/u

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
  yesterday: 'dun',
  week: '7gun',
  month: '30gun',
  calendar_month: 'bu-ay',
  quarter: 'ceyrek',
  year: 'yil',
}

export function escapeAnalyticsCsvCell(value: CsvValue): string {
  if (value === null) return ''
  const raw = String(value)
  // User-controlled names, emails and close reasons must not become formulas
  // when the CSV is opened in Excel or Sheets. Control-character prefixes and
  // full-width variants are included because spreadsheet importers can treat
  // them as formula triggers too.
  const mustForceText = SPREADSHEET_FORMULA_PREFIX.test(raw)
    || SPREADSHEET_CONTROL_PREFIX.test(raw)
  const safe = mustForceText ? `'${raw}` : raw
  return /[",\n\r;]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe
}

function rowsToCsv(rows: CsvValue[][]): string {
  return rows.map((row) => row.map(escapeAnalyticsCsvCell).join(',')).join('\r\n')
}

export function buildAnalyticsReportCsv(
  report: AnalyticsReportId,
  rangeInput: string | AnalyticsQuery,
  data: AnalyticsData,
): { filename: string; csv: string } | null {
  const query = coerceAnalyticsQuery(rangeInput)
  const effectiveFilters = report === 'sadakat'
    ? { source: 'all', paymentMethod: 'all', status: 'all' }
    : query.filters
  const period = analyticsRangePeriodLabel(query)
  const rows: CsvValue[][] = []
  const section = (title: string) => {
    if (rows.length > 0) rows.push([])
    rows.push([title])
  }
  section('Rapor kapsamı')
  rows.push(['Dönem', period])
  rows.push(['Şube kapsamı', 'Aktif restoran'])
  rows.push(['Kanal', effectiveFilters.source])
  rows.push(['Ödeme yöntemi', effectiveFilters.paymentMethod])
  rows.push(['Sipariş durumu', effectiveFilters.status])
  rows.push(['Filtre birleşimi', 'AND'])

  if (report === 'sales') {
    section(`Satış Raporu — seçili dönem özeti (${period})`)
    rows.push(['Metrik', 'Seçili dönem', 'Önceki eş dönem'])
    rows.push(['Tahsil edilen (₺)', data.rangeKpis.revenue, data.rangeKpis.previousRevenue])
    rows.push(['Sipariş hacmi', data.rangeKpis.orders, data.rangeKpis.previousOrders])
    rows.push(['Ödemeli sipariş', data.rangeKpis.paidOrders, data.rangeKpis.previousPaidOrders])
    rows.push(['Ort. tahsilat (₺)', data.rangeKpis.avgBasket, null])
    rows.push(['Oturum', data.rangeKpis.sessions, data.rangeKpis.previousSessions])
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
    rows.push(['Finansal metrik', 'Tutar (₺)'])
    rows.push(['Brüt ürün satışı', data.paymentBreakdown.financials.grossSales])
    rows.push(['İndirim', data.paymentBreakdown.financials.discountTotal])
    rows.push(['İndirim sonrası satış', data.paymentBreakdown.financials.netSales])
    rows.push(['Hesaplanan KDV', data.paymentBreakdown.financials.vatTotal])
    rows.push(['KDV hariç', data.paymentBreakdown.financials.netOfVatTotal])
    rows.push(['KDV oranı eksik brüt', data.paymentBreakdown.financials.unknownVatGross])
    rows.push(['Ürün dışı ayrıştırılmamış tutar', data.paymentBreakdown.financials.unattributedAmount])
    rows.push(['Başarılı parasal iade', data.paymentBreakdown.coverage.monetaryRefunds ? data.paymentBreakdown.refunds.total : 'Kullanılamıyor'])
    rows.push(['Tam iade adedi', data.paymentBreakdown.coverage.monetaryRefunds ? data.paymentBreakdown.refunds.fullCount : 'Kullanılamıyor'])
    rows.push(['Kısmi iade adedi', data.paymentBreakdown.coverage.monetaryRefunds ? data.paymentBreakdown.refunds.partialCount : 'Kullanılamıyor'])
    rows.push(['İade sonrası net tahsilat', data.paymentBreakdown.coverage.monetaryRefunds ? data.paymentBreakdown.refunds.netCollected : 'Kullanılamıyor'])
    if (!data.paymentBreakdown.coverage.monetaryRefunds) rows.push(['Kapsam uyarısı', 'İade defteri okunamadığı için iade ve net tahsilat kullanılamaz.'])
    rows.push(['Kapsam notu', 'Servis ücreti ve bahşiş için ayrı kaynak alanı bulunmadığından rapora dahil değildir.'])
    rows.push([])
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
    rows.push(['Tahsil edilmemiş iptal (₺)', cancellations.lostAmount])
    rows.push(['Tahsilat işaretli iptal (₺)', cancellations.collectedCancelledAmount])
    rows.push(['Tahsilat işaretli iptal adedi', cancellations.collectedCancelledCount])
    rows.push(['İkram iptali (₺)', cancellations.compCancelledAmount])
    rows.push(['İkram iptali adedi', cancellations.compCancelledCount])
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
    filename: `${EXPORT_SLUGS[report]}-${query.range === 'custom' ? `${query.from}-${query.to}` : RANGE_SLUGS[query.range] ?? query.range}.csv`,
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
