'use client'

import { useMemo, useState } from 'react'
import type { PlatformBillingTimelineItem } from '@garsonless/application/platform-admin-billing'
import { refundTenantSubscriptionInvoice } from '../../actions'

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Istanbul',
  }).format(new Date(value))
}

function formatMoney(amountMinor: number, currency = 'TRY') {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency }).format(amountMinor / 100)
}

function amountInput(amountMinor: number) {
  return (amountMinor / 100).toFixed(2).replace('.', ',')
}

export function SubscriptionRefundForm({
  paidInvoices,
  refunds,
  restaurantId,
}: {
  paidInvoices: PlatformBillingTimelineItem[]
  refunds: PlatformBillingTimelineItem[]
  restaurantId: string
}) {
  const [invoiceId, setInvoiceId] = useState(paidInvoices[0]?.invoiceId ?? '')
  const selected = paidInvoices.find((invoice) => invoice.invoiceId === invoiceId) ?? paidInvoices[0]
  const invoiceRefunds = useMemo(
    () => refunds.filter((refund) => refund.invoiceId === selected?.invoiceId),
    [refunds, selected?.invoiceId],
  )
  const refundedMinor = invoiceRefunds
    .filter((refund) => refund.status === 'succeeded')
    .reduce((sum, refund) => sum + (refund.amountMinor ?? 0), 0)
  const reservedMinor = invoiceRefunds
    .filter((refund) => ['requested', 'processing', 'requires_reconciliation'].includes(refund.status))
    .reduce((sum, refund) => sum + (refund.amountMinor ?? 0), 0)
  const paidMinor = selected?.amountMinor ?? 0
  const refundableMinor = Math.max(0, paidMinor - refundedMinor - reservedMinor)
  const [kind, setKind] = useState<'refund' | 'same_day_cancel'>('refund')
  const [accessAction, setAccessAction] = useState<'keep' | 'cancel_immediately'>('keep')
  const [amount, setAmount] = useState(() => amountInput(refundableMinor))
  const parsedAmountMinor = Math.round(Number(amount.replace(',', '.')) * 100)
  const isFullRemaining = Number.isFinite(parsedAmountMinor) && parsedAmountMinor === refundableMinor
  const effectiveAccessAction = kind === 'same_day_cancel'
    ? 'cancel_immediately'
    : isFullRemaining
      ? accessAction
      : 'keep'

  function selectInvoice(nextInvoiceId: string) {
    setInvoiceId(nextInvoiceId)
    const next = paidInvoices.find((invoice) => invoice.invoiceId === nextInvoiceId)
    const prior = refunds.filter((refund) => refund.invoiceId === nextInvoiceId
      && ['succeeded', 'requested', 'processing', 'requires_reconciliation'].includes(refund.status))
      .reduce((sum, refund) => sum + (refund.amountMinor ?? 0), 0)
    setAmount(amountInput(Math.max(0, (next?.amountMinor ?? 0) - prior)))
    setKind('refund')
    setAccessAction('keep')
  }

  function selectKind(nextKind: 'refund' | 'same_day_cancel') {
    setKind(nextKind)
    if (nextKind === 'same_day_cancel') {
      setAccessAction('cancel_immediately')
      setAmount(amountInput(refundableMinor))
    }
  }

  return (
    <form action={refundTenantSubscriptionInvoice} className="dunning-intervention-form">
      <input name="restaurantId" type="hidden" value={restaurantId} />
      <input name="accessAction" type="hidden" value={effectiveAccessAction} />
      <label className="reason-field"><span>Ödenmiş fatura</span>
        <select name="invoiceId" onChange={(event) => selectInvoice(event.target.value)} value={invoiceId} required>
          {paidInvoices.map((item) => <option key={item.id} value={item.invoiceId ?? ''}>
            …{item.invoiceId?.slice(-8)} · {formatMoney(item.amountMinor ?? 0, item.currency ?? 'TRY')} · {formatDate(item.completedAt)}
          </option>)}
        </select>
      </label>
      <div className="refund-amount-summary" aria-label="İade tutarı özeti">
        <div><span>Ödenen</span><strong>{formatMoney(paidMinor)}</strong></div>
        <div><span>İade edilen</span><strong>{formatMoney(refundedMinor)}</strong></div>
        <div><span>İşlemde / kontrolde</span><strong>{formatMoney(reservedMinor)}</strong></div>
        <div><span>Kalan iade edilebilir</span><strong>{formatMoney(refundableMinor)}</strong></div>
      </div>
      <div className="dunning-command-grid">
        <label className="reason-field"><span>İşlem tipi</span>
          <select name="kind" onChange={(event) => selectKind(event.target.value as typeof kind)} value={kind}>
            <option value="refund">Tam veya kısmi iade</option>
            <option value="same_day_cancel">Tam iade + erişimi hemen kapat</option>
          </select>
          <small>Aynı gün iptal yalnız ödemenin İstanbul takvim gününde ve kalan tutarın tamamı için kabul edilir.</small>
        </label>
        <label className="reason-field"><span>Tutar (TRY)</span>
          <input inputMode="decimal" max={amountInput(refundableMinor).replace(',', '.')}
            name="amount" onChange={(event) => setAmount(event.target.value)}
            pattern="[0-9]+([,.][0-9]{1,2})?" value={amount} required />
        </label>
        <label className="reason-field"><span>Gerekçe sınıfı</span><select defaultValue="customer_request" name="reasonCode">
          <option value="customer_request">Müşteri talebi</option><option value="billing_error">Faturalama hatası</option>
          <option value="duplicate_charge">Mükerrer tahsilat</option><option value="service_issue">Hizmet sorunu</option>
          <option value="legal">Hukuki gereklilik</option><option value="other">Diğer</option>
        </select></label>
      </div>
      <fieldset className="refund-access-fieldset" disabled={kind === 'same_day_cancel' || !isFullRemaining}>
        <legend>İade sonrası erişim</legend>
        <label><input checked={effectiveAccessAction === 'keep'} name="accessActionChoice"
          onChange={() => setAccessAction('keep')} type="radio" value="keep" />
          <span><strong>Abonelik açık kalsın</strong><small>Para iade edilir; plan ve özellikler değişmez.</small></span>
        </label>
        <label><input checked={effectiveAccessAction === 'cancel_immediately'} name="accessActionChoice"
          onChange={() => setAccessAction('cancel_immediately')} type="radio" value="cancel_immediately" />
          <span><strong>İade et ve aboneliği hemen kapat</strong><small>Özellikler anında kilitlenir; İyzico iptali arka planda doğrulanır.</small></span>
        </label>
        {!isFullRemaining && kind === 'refund' ? <p>Kısmi iadelerde erişim güvenlik gereği açık kalır.</p> : null}
      </fieldset>
      <label className="reason-field"><span>İşlem gerekçesi</span>
        <textarea minLength={10} maxLength={1000} name="reasonDetail" required />
      </label>
      <div className="guarded-operation" role="note">
        <strong>{effectiveAccessAction === 'cancel_immediately' ? 'İade sonrası erişim hemen kilitlenir' : 'İade aboneliği açık bırakır'}</strong>
        <p>{effectiveAccessAction === 'cancel_immediately'
          ? 'İade doğrulanınca ücretli özellikler kapanır. Tüm İyzico abonelik referansları iptal edilmeden kayıt nihai olarak iptal edildi sayılmaz.'
          : 'Kısmi iadeler ve “açık kalsın” seçimi planı veya ücretli özellikleri değiştirmez. Belirsiz sağlayıcı yanıtı körlemesine tekrar gönderilmez.'}</p>
      </div>
      <div className="lifecycle-actions">
        <button className="button danger-button" disabled={refundableMinor <= 0} type="submit">
          {kind === 'same_day_cancel' ? 'Tam iade et ve erişimi kapat' : 'İade talebini gönder'}
        </button>
      </div>
    </form>
  )
}
