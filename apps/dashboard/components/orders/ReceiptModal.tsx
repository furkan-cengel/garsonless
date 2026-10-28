'use client'

import Image from 'next/image'
import { computeVatBreakdown, readOrderLineSnapshots, type PaymentMethod } from '@garsonless/db/browser'
import { I, S } from '../../lib/ui'
import { formatCurrency } from '../../lib/utils'
import { paymentMethodBadge } from '../../lib/payment-method'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const FISCAL_DISCLAIMER = 'MALİ DEĞERİ YOKTUR · FİŞ YERİNE GEÇMEZ'

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
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent showCloseButton={false} className="max-h-[94dvh] gap-3 overflow-hidden bg-transparent p-0 ring-0 sm:max-w-[340px]">
        <DialogHeader className="sr-only">
          <DialogTitle>{restaurantName} sipariş fişi</DialogTitle>
          <DialogDescription>{tableLabel} için sipariş ve ödeme özeti</DialogDescription>
        </DialogHeader>
        <style dangerouslySetInnerHTML={{ __html: '@media print{body *{visibility:hidden!important}.receipt-print,.receipt-print *{visibility:visible!important}.receipt-print{position:absolute;left:0;top:0;box-shadow:none!important}}@media(max-width:390px){.receipt-print,.order-receipt-actions{width:100%!important}}' }} />
      <div className="order-receipt-shell flex max-h-[94dvh] w-full flex-col items-center gap-3">
        <div className="receipt-print" style={{
          width: 320, background: '#fff', borderRadius: 6, boxShadow: 'var(--shadow-pop)',
          overflow: 'auto', padding: '22px 24px',
          fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace", color: '#1a1a1a',
        }}>
          {/* Header */}
          <div style={{ textAlign: 'center', borderBottom: '1.5px dashed #cfcfcf', paddingBottom: 14 }}>
            {/* Real wordmark — receipt is white (screen + print), vector stays sharp when printed. */}
            <Image src="/brand/masabu-logo-transparent.svg" alt="masabu" width={93} height={20} style={{ height: 20, width: 'auto', display: 'block', margin: '0 auto 8px' }} />
            <div id="order-receipt-title" style={{ fontFamily: 'system-ui, sans-serif', fontWeight: 700, fontSize: 15 }}>{restaurantName} sipariş fişi</div>
            {/* GMP-3 6.1/15: a non-fiscal printout must say so prominently; only the ÖKC issues the fiscal receipt. */}
            <div style={{ marginTop: 8, padding: '4px 6px', border: '1.5px solid #1a1a1a', fontFamily: 'system-ui, sans-serif', fontWeight: 800, fontSize: 11, letterSpacing: '.02em' }}>
              {FISCAL_DISCLAIMER}
            </div>
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
                <span style={{ flex: 1 }}><span style={{ color: '#777' }}>{it.quantity}×</span> {it.name}{it.promotion?.offer === 'freebie' && it.promotion.role === 'reward' ? ' · KAMPANYA HEDİYESİ' : ''}</span>
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
                      <ReceiptRow label="İndirim" value={`-${formatCurrency(vat.discountTotal)}`} />
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
            <div style={{ fontWeight: 700, color: '#1a1a1a' }}>{FISCAL_DISCLAIMER}</div>
            masabu ile · Teşekkürler!
          </div>
        </div>

        <div className="order-receipt-actions" style={{ display: 'flex', gap: 8, width: 320 }}>
          <Button type="button" variant="outline" onClick={onClose} className="h-10 flex-1 bg-background">Kapat</Button>
          <Button type="button" onClick={() => window.print()} className="h-10 flex-[2]">
            <I.history size={14} />Yazdır
          </Button>
        </div>
      </div>
      </DialogContent>
    </Dialog>
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
