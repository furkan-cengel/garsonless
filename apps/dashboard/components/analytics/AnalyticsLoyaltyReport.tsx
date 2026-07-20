'use client'

import type { CSSProperties } from 'react'
import type { LoyaltyReport } from '../../lib/queries/analytics'
import { formatCurrency } from '../../lib/utils'
import { AnalyticsCard as Card, AnalyticsKpi as KPISmall } from './AnalyticsReportPrimitives'
import { analyticsRangePeriodLabel as rangePeriodLabel } from './analytics-report-model'
import { projectLoyaltyReport, resolveLoyaltyReasonLabel } from './analytics-loyalty-model'

const s = { mono: { fontFamily: "'Geist Mono', ui-monospace, monospace" } as CSSProperties }

export function AnalyticsLoyaltyReport({ loyalty, range }: { loyalty: LoyaltyReport; range: string }) {
  const report = projectLoyaltyReport(loyalty)

  return (
    <div style={{ maxWidth: 1140 }}>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0, color: 'var(--text)' }}>Sadakat Raporu</h1>
        <p style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4, marginBottom: 0 }}>
          {rangePeriodLabel(range)} · puan, damga, ziyaret ve İkram hareketleri
        </p>
      </div>

      {!report.hasActivity ? (
        <div style={{
          padding: '48px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13,
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
        }}>
          Bu dönemde sadakat hareketi yok. Sadakat programı Ayarlar → Sadakat bölümünden yönetilir.
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 12 }}>
            <KPISmall label="Kazandırılan puan" value={loyalty.pointsIssued.toLocaleString('tr-TR')} delta="hoş geldin dahil" tone="neutral" direction="flat" />
            <KPISmall label="Kullanılan puan" value={loyalty.pointsRedeemed.toLocaleString('tr-TR')} delta={`%${loyalty.redeemRate.toLocaleString('tr-TR')} kullanım oranı`} tone="neutral" direction="flat" />
            <KPISmall label="Ziyaret" value={loyalty.visits.toLocaleString('tr-TR')} delta="kapanan adisyonlardan" tone="neutral" direction="flat" />
            {/* İkram — getPaymentBreakdown'ın comp rakamıyla AYNI (₺0 tahsilat). */}
            <KPISmall label="İkram edilen" value={formatCurrency(loyalty.comp.amount)} delta={report.compDelta} tone="neutral" direction="flat" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
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
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>Bu dönemde kullanım yok</div>
            ) : (
              <div style={{ padding: '4px 0' }}>
                {loyalty.redemptionsByReason.map((r, i, arr) => (
                  <div key={r.reason} style={{
                    display: 'grid', gridTemplateColumns: 'minmax(160px, 1fr) 90px 110px 110px', gap: 10,
                    alignItems: 'center', padding: '10px 16px',
                    borderBottom: i === arr.length - 1 ? 'none' : '1px solid var(--divider)',
                  }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>{resolveLoyaltyReasonLabel(r.reason)}</span>
                    <span style={{ ...s.mono, fontSize: 11.5, textAlign: 'right', color: 'var(--text-2)' }}>{r.count} işlem</span>
                    <span style={{ ...s.mono, fontSize: 11.5, textAlign: 'right', color: 'var(--text-2)' }}>{r.points ? `${r.points.toLocaleString('tr-TR')} puan` : '—'}</span>
                    <span style={{ ...s.mono, fontSize: 11.5, textAlign: 'right', color: 'var(--text-2)' }}>{r.stamps ? `${r.stamps} damga` : '—'}</span>
                  </div>
                ))}
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
