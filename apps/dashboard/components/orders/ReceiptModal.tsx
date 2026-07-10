'use client'

import { computeVatBreakdown, readOrderLineSnapshots, type PaymentMethod } from '@garsonless/db/order-client'
import { I, S, btnPrimary, btnGhost } from '../../lib/ui'
import { formatCurrency } from '../../lib/utils'
import { paymentMethodBadge } from '../../lib/payment-method'

export interface ReceiptOrder {
  id: string
  items: unknown
  total: number
  created_at: string
  paid_at: string | null
  payment_method?: string | null
  status: string
}

export default function ReceiptModal({ order, restaurantName, tax, tableLabel, onClose }: {
  order: ReceiptOrder
  restaurantName: string
  tax?: Record<string, unknown> | null
  tableLabel: string
  onClose: () => void
}) {
  const items = readOrderLineSnapshots(order.items)
  // Pass the REAL charged total: VAT is derived from the DISCOUNTED base, so the
  // printed net + KDV rows always sum to TOPLAM (a discounted order previously
  // printed line-basis KDV that visibly disagreed with its own total).
  const vat = computeVatBreakdown(items, order.total)
  const hasVatBreakdown = vat.byRate.length > 0
  const when = new Date(order.created_at).toLocaleString('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
  const isPaid = order.paid_at !== null || order.status === 'paid'
  const methodBadge = isPaid ? paymentMethodBadge((order.payment_method as PaymentMethod | null | undefined) ?? null) : null
  const company = taxText(tax?.['company'])
  const taxNumber = taxText(tax?.['taxNumber'] ?? tax?.['tcVkn'])
  const taxOffice = taxText(tax?.['office'])
  const taxAddress = taxText(tax?.['address'])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 110,
        background: 'rgba(17,17,19,.5)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: '@media print{body *{visibility:hidden!important}.receipt-print,.receipt-print *{visibility:visible!important}.receipt-print{position:absolute;left:0;top:0;box-shadow:none!important}}' }} />
      <div onClick={(e) => e.stopPropagation()} style={{ width: 340, maxHeight: '90vh', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <div className="receipt-print" style={{
          width: 320, background: '#fff', borderRadius: 6, boxShadow: 'var(--shadow-pop)',
          overflow: 'auto', padding: '22px 24px',
          fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace", color: '#1a1a1a',
        }}>
          {/* Header */}
          <div style={{ textAlign: 'center', borderBottom: '1.5px dashed #cfcfcf', paddingBottom: 14 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 8, background: '#18181b', color: '#fff',
              display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 16, margin: '0 auto 8px',
              fontFamily: 'system-ui, sans-serif',
            }}>g</div>
            <div style={{ fontFamily: 'system-ui, sans-serif', fontWeight: 700, fontSize: 15 }}>{restaurantName}</div>
            <div style={{ fontSize: 10.5, color: '#777', marginTop: 2 }}>garsonless</div>
            {(company || taxNumber || taxOffice || taxAddress) && (
              <div style={{ marginTop: 8, fontSize: 9.5, color: '#666', lineHeight: 1.45 }}>
                {company && <div>{company}</div>}
                {(taxOffice || taxNumber) && <div>{[taxOffice, taxNumber].filter(Boolean).join(' · ')}</div>}
                {taxAddress && <div>{taxAddress}</div>}
              </div>
            )}
          </div>

          {/* Meta */}
          <div style={{ padding: '12px 0 4px' }}>
            <ReceiptRow label="Sipariş" value={`#${order.id.slice(0, 8).toUpperCase()}`} />
            <ReceiptRow label="Masa" value={tableLabel} />
            <ReceiptRow label="Tarih" value={when} />
            {methodBadge && <ReceiptRow label="Ödeme" value={methodBadge.label} />}
          </div>

          {/* Items */}
          <div style={{ borderTop: '1.5px dashed #cfcfcf', margin: '12px 0', paddingTop: 12 }}>
            {items.length ? items.map((it, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, padding: '4px 0', gap: 8 }}>
                <span style={{ flex: 1 }}><span style={{ color: '#777' }}>{it.quantity}×</span> {it.name}</span>
                {it.price !== undefined && (
                  <span style={{ fontWeight: 600 }}>{formatCurrency(it.quantity * (it.price + it.modifiersPriceDelta))}</span>
                )}
              </div>
            )) : <div style={{ fontSize: 11, color: '#777', textAlign: 'center', padding: '4px 0' }}>Kalem dökümü mevcut değil</div>}
          </div>

          {items.length > 0 && (
            <div style={{ borderTop: '1.5px dashed #cfcfcf', margin: '10px 0 0', paddingTop: 10 }}>
              {hasVatBreakdown ? (
                <>
                  {vat.discountTotal > 0 && (
                    <>
                      <ReceiptRow label="Satır toplamı" value={formatCurrency(vat.grossTotal + vat.discountTotal)} />
                      <ReceiptRow label="İndirim" value={`−${formatCurrency(vat.discountTotal)}`} />
                    </>
                  )}
                  <ReceiptRow label="Ara toplam KDV hariç" value={formatCurrency(vat.netTotal)} />
                  {vat.byRate.map(row => (
                    <ReceiptRow key={row.rate} label={`KDV %${formatRate(row.rate)}`} value={formatCurrency(row.vat)} />
                  ))}
                  {vat.unknownGrossTotal > 0 && (
                    <div style={{ fontSize: 10, color: '#777', lineHeight: 1.45, paddingTop: 4 }}>
                      Bazı eski kalemlerde KDV oranı yok: {formatCurrency(vat.unknownGrossTotal)}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: 10, color: '#777', lineHeight: 1.45 }}>
                  KDV dökümü mevcut değil. Bu sipariş KDV oranı snapshot'ından önce oluşturulmuş olabilir.
                </div>
              )}
            </div>
          )}

          {/* Total — the real, post-discount order total */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: '1.5px solid #1a1a1a', marginTop: 10, paddingTop: 10 }}>
            <span style={{ fontFamily: 'system-ui, sans-serif', fontWeight: 700, fontSize: 14 }}>TOPLAM</span>
            <span style={{ fontWeight: 700, fontSize: 18 }}>{formatCurrency(order.total)}</span>
          </div>

          <div style={{ textAlign: 'center', fontSize: 10.5, color: '#777', marginTop: 16, borderTop: '1.5px dashed #cfcfcf', paddingTop: 14, lineHeight: 1.7 }}>
            garsonless ile · Teşekkürler!
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, width: 320 }}>
          <button onClick={onClose} style={{ flex: 1, ...btnGhost(), justifyContent: 'center' }}>Kapat</button>
          <button onClick={() => window.print()} style={{ flex: 2, ...btnPrimary(), justifyContent: 'center' }}>
            <I.history size={14} />Yazdır
          </button>
        </div>
      </div>
    </div>
  )
}

function ReceiptRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '2px 0' }}>
      <span style={{ color: '#777' }}>{label}</span>
      <span style={{ fontWeight: 600, ...S.mono }}>{value}</span>
    </div>
  )
}

function taxText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function formatRate(rate: number): string {
  return Number.isInteger(rate) ? String(rate) : rate.toLocaleString('tr-TR', { maximumFractionDigits: 2 })
}
