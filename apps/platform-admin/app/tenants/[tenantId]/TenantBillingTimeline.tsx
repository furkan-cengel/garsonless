import type {
  PlatformBillingTimelineItem,
  PlatformTenantBillingTimeline,
} from '@garsonless/application/platform-admin-billing'

const KIND_LABELS: Record<PlatformBillingTimelineItem['kind'], string> = {
  invoice: 'Fatura',
  payment_attempt: 'Tahsilat denemesi',
  dunning: 'Ödeme takibi',
  reconciliation: 'Mutabakat',
  provider_event: 'Provider olayı',
  provider_operation: 'Provider işlemi',
}

const ACTION_LABELS: Record<string, string> = {
  invoice: 'Fatura durumu',
  'payment.attempt': 'Tahsilat denemesi',
  pre_due: 'Vade öncesi hatırlatma',
  due: 'Vade günü',
  retry: 'Yeniden deneme',
  warning_3: '3. gün uyarısı',
  warning_7: '7. gün uyarısı',
  suspend: 'Hizmet askısı',
  subscription: 'Abonelik mutabakatı',
  provider_event: 'Provider olayı mutabakatı',
  tenant: 'Tenant mutabakatı',
  'checkout.completed': 'Ödeme oturumu tamamlandı',
  'invoice.payment_succeeded': 'Tahsilat başarılı',
  'invoice.payment_failed': 'Tahsilat başarısız',
  'subscription.cancelled': 'Abonelik iptal edildi',
  'subscription.updated': 'Abonelik güncellendi',
  unknown: 'Bilinmeyen provider olayı',
  'checkout.initialize': 'Ödeme oturumu başlatma',
  'payment.retry': 'Tahsilatı yeniden deneme',
  'subscription.cancel': 'Abonelik iptali',
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Istanbul',
  }).format(new Date(value))
}

function formatMoney(amountMinor: number | null, currency: string | null) {
  if (amountMinor === null || currency === null) return null
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency }).format(amountMinor / 100)
}

function itemTone(item: PlatformBillingTimelineItem) {
  if (item.hasError || ['failed', 'past_due', 'uncollectible', 'dead_lettered', 'discrepancy'].includes(item.status)) {
    return 'danger'
  }
  if (['paid', 'succeeded', 'processed', 'resolved', 'completed', 'stopped'].includes(item.status)) {
    return 'success'
  }
  return 'neutral'
}

export function TenantBillingTimelinePanel({
  failed,
  timeline,
}: {
  failed: boolean
  timeline: PlatformTenantBillingTimeline | null
}) {
  if (failed) {
    return (
      <article className="panel billing-timeline-panel">
        <div className="panel-heading"><div><p className="eyebrow">Finans</p><h2>Ödeme ve dunning zaman çizelgesi</h2></div><span className="read-only">Salt okunur</span></div>
        <p className="empty-inline" role="alert">Finans görünümü güvenli biçimde yüklenemedi. Diğer tenant verileri etkilenmedi.</p>
      </article>
    )
  }

  if (!timeline) return null

  const summary = timeline.summary
  return (
    <article className="panel billing-timeline-panel">
      <div className="panel-heading billing-heading">
        <div><p className="eyebrow">Finans</p><h2>Ödeme ve dunning zaman çizelgesi</h2></div>
        <span className="read-only">Salt okunur</span>
      </div>
      <div className="billing-summary-grid">
        <div><span>Açık bakiye</span><strong>{formatMoney(summary.outstandingMinor, summary.currency)}</strong></div>
        <div><span>Açık fatura</span><strong>{summary.openInvoices}</strong></div>
        <div><span>Aktif takip</span><strong>{summary.activeDunning}</strong></div>
        <div><span>Mutabakat</span><strong>{summary.openReconciliation}</strong></div>
        <div><span>Başarısız deneme</span><strong>{summary.failedAttempts}</strong></div>
      </div>
      {timeline.items.length === 0 ? (
        <p className="empty-inline">Henüz ödeme yaşam döngüsü kaydı yok.</p>
      ) : (
        <div className="billing-timeline-list">
          {timeline.items.map((item) => {
            const amount = formatMoney(item.amountMinor, item.currency)
            return (
              <div className="billing-timeline-row" key={`${item.kind}:${item.id}`}>
                <span className="timeline-marker" data-tone={itemTone(item)} aria-hidden="true" />
                <div className="timeline-copy">
                  <div className="timeline-title"><strong>{ACTION_LABELS[item.action] ?? item.action}</strong><span>{KIND_LABELS[item.kind]}</span></div>
                  <div className="timeline-meta">
                    <span>{formatDate(item.occurredAt)}</span>
                    {item.attempt !== null ? <span>Deneme {item.attempt}</span> : null}
                    {item.nextActionAt ? <span>Sonraki adım {formatDate(item.nextActionAt)}</span> : null}
                  </div>
                </div>
                <div className="timeline-result">
                  <span className="status" data-tone={itemTone(item)}>{item.status}</span>
                  {amount ? <strong>{amount}</strong> : null}
                </div>
              </div>
            )
          })}
        </div>
      )}
      <p className="billing-privacy-note">Provider referansları, payload, hata metni ve müşteri PII bilgileri bu görünümde yer almaz.</p>
    </article>
  )
}
