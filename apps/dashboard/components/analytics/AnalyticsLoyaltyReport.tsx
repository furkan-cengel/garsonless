'use client'

import type { CSSProperties } from 'react'
import type { LoyaltyReport } from '../../lib/queries/analytics'
import { formatCurrency } from '../../lib/utils'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '../ui/empty'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'
import { AnalyticsCard as Card, AnalyticsKpi as KPISmall } from './AnalyticsReportPrimitives'
import { analyticsRangePeriodLabel as rangePeriodLabel } from './analytics-report-model'
import { projectLoyaltyReport, resolveLoyaltyReasonLabel } from './analytics-loyalty-model'
import type { AnalyticsQuery } from '../../lib/analytics-filter-contract'

const s = { mono: { fontFamily: "'Geist Mono', ui-monospace, monospace" } as CSSProperties }

export function AnalyticsLoyaltyReport({ loyalty, query }: { loyalty: LoyaltyReport; query: AnalyticsQuery }) {
  const report = projectLoyaltyReport(loyalty)

  return (
    <div style={{ maxWidth: 1140 }}>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0, color: 'var(--text)' }}>Sadakat Raporu</h1>
        <p style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4, marginBottom: 0 }}>
          {rangePeriodLabel(query)} · puan, damga, ziyaret ve İkram hareketleri
        </p>
      </div>

      {!report.hasActivity ? (
        <Empty className="min-h-48 border bg-card">
          <EmptyHeader><EmptyTitle>Sadakat hareketi yok</EmptyTitle><EmptyDescription>Bu dönemde hareket oluşmadı. Sadakat programı Ayarlar → Sadakat bölümünden yönetilir.</EmptyDescription></EmptyHeader>
        </Empty>
      ) : (
        <>
          <div className="analytics-responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 12 }}>
            <KPISmall label="Kazandırılan puan" value={loyalty.pointsIssued.toLocaleString('tr-TR')} delta="hoş geldin dahil" tone="neutral" direction="flat" />
            <KPISmall label="Kullanılan puan" value={loyalty.pointsRedeemed.toLocaleString('tr-TR')} delta={`%${loyalty.redeemRate.toLocaleString('tr-TR')} kullanım oranı`} tone="neutral" direction="flat" />
            <KPISmall label="Ziyaret" value={loyalty.visits.toLocaleString('tr-TR')} delta="kapanan adisyonlardan" tone="neutral" direction="flat" />
            {/* İkram — getPaymentBreakdown'ın comp rakamıyla AYNI (₺0 tahsilat). */}
            <KPISmall label="İkram edilen" value={formatCurrency(loyalty.comp.amount)} delta={report.compDelta} tone="neutral" direction="flat" />
          </div>

          <div className="analytics-responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
            <Card title="Damga" subtitle="Kazanılan · kullanılan · iade">
              <MiniStatRows rows={report.stampRows} />
            </Card>
            <Card title="Hoş geldin bonusu" subtitle="Yeni üyelik kazanımları">
              <MiniStatRows rows={report.welcomeRows} />
            </Card>
            <Card title="İadeler" subtitle="İptal edilen siparişlerden geri dönen">
              <MiniStatRows rows={report.refundRows} />
            </Card>
          </div>

          <Card title="Kullanımlar" subtitle="Defterdeki ham sebep bazında (redeem satırları)">
            {loyalty.redemptionsByReason.length === 0 ? (
              <Empty className="min-h-32"><EmptyHeader><EmptyTitle>Kullanım yok</EmptyTitle><EmptyDescription>Bu dönemde puan veya damga kullanımı oluşmadı.</EmptyDescription></EmptyHeader></Empty>
            ) : (
              <div className="analytics-table-scroll" role="region" aria-label="Sadakat kullanımları" tabIndex={0}>
                <Table className="min-w-[520px]">
                  <TableHeader><TableRow><TableHead>Sebep</TableHead><TableHead className="text-right">İşlem</TableHead><TableHead className="text-right">Puan</TableHead><TableHead className="text-right">Damga</TableHead></TableRow></TableHeader>
                  <TableBody>{loyalty.redemptionsByReason.map((row) => (
                    <TableRow key={row.reason}>
                      <TableCell className="font-medium">{resolveLoyaltyReasonLabel(row.reason)}</TableCell>
                      <TableCell style={s.mono} className="text-right text-muted-foreground">{row.count} işlem</TableCell>
                      <TableCell style={s.mono} className="text-right text-muted-foreground">{row.points ? `${row.points.toLocaleString('tr-TR')} puan` : '-'}</TableCell>
                      <TableCell style={s.mono} className="text-right text-muted-foreground">{row.stamps ? `${row.stamps} damga` : '-'}</TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}

function MiniStatRows({ rows }: { rows: Array<{ label: string; value: number }> }) {
  return (
    <div style={{ padding: '4px 0' }}>
      {rows.map((r, i) => (
        <div key={r.label} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '9px 16px', borderBottom: i === rows.length - 1 ? 'none' : '1px solid var(--divider)',
        }}>
          <span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{r.label}</span>
          <span style={{ ...s.mono, fontSize: 13, fontWeight: 700, color: r.value > 0 ? 'var(--text)' : 'var(--text-4)' }}>{r.value.toLocaleString('tr-TR')}</span>
        </div>
      ))}
    </div>
  )
}
