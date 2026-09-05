import type {
  PlatformBillingTimelineItem,
  PlatformTenantBillingTimeline,
} from '@garsonless/application/platform-admin-billing'
import { interveneTenantDunning } from '../../actions'
import { billingStatusLabel } from '../../../lib/tenant-presentation'
import { SubscriptionRefundForm } from './SubscriptionRefundForm'

const KIND_LABELS: Record<PlatformBillingTimelineItem['kind'], string> = {
  invoice: 'Fatura',
  payment_attempt: 'Tahsilat denemesi',
  dunning: 'Ödeme takibi',
  reconciliation: 'Mutabakat',
  provider_event: 'Ödeme sağlayıcı olayı',
  provider_operation: 'Ödeme sağlayıcı işlemi',
  refund: 'Abonelik iadesi',
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
  provider_event: 'Ödeme sağlayıcı olayı mutabakatı',
  tenant: 'İşletme mutabakatı',
  'checkout.completed': 'Ödeme oturumu tamamlandı',
  'invoice.payment_succeeded': 'Tahsilat başarılı',
  'invoice.payment_failed': 'Tahsilat başarısız',
  'subscription.cancelled': 'Abonelik iptal edildi',
  'subscription.updated': 'Abonelik güncellendi',
  unknown: 'Bilinmeyen ödeme sağlayıcı olayı',
  'checkout.initialize': 'Ödeme oturumu başlatma',
  'payment.retry': 'Tahsilatı yeniden deneme',
  'subscription.cancel': 'Abonelik iptali',
  'subscription.change': 'Abonelik değişikliği',
  'card_update.initialize': 'Kart güncelleme oturumu',
  'subscription.refund': 'Abonelik iadesi sağlayıcı işlemi',
  same_day_cancel: 'Aynı gün tam iptal',
  refund: 'Tam/kısmi iade',
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
  if (item.cancellationStatus === 'requires_reconciliation') return 'danger'
  if (item.hasError || ['failed', 'past_due', 'uncollectible', 'dead_lettered', 'discrepancy'].includes(item.status)) {
    return 'danger'
  }
  if (['paid', 'succeeded', 'processed', 'resolved', 'completed', 'stopped'].includes(item.status)) {
    return 'success'
  }
  return 'neutral'
}

function refundAccessLabel(item: PlatformBillingTimelineItem) {
  if (item.kind !== 'refund' || item.accessAction === null) return null
  if (item.accessAction === 'keep') return 'İade tamamlandı · erişim açık kaldı'
  if (item.cancellationStatus === 'applied') return 'Abonelik iptal edildi'
  if (item.cancellationStatus === 'requires_reconciliation') return 'Manuel kontrol gerekiyor'
  return 'Abonelik kapatılıyor'
}

export function TenantBillingTimelinePanel({
  failed,
  restaurantId,
  timeline,
}: {
  failed: boolean
  restaurantId: string
  timeline: PlatformTenantBillingTimeline | null
}) {
  if (failed) {
    return (
      <article className="panel billing-timeline-panel">
        <div className="panel-heading"><div><p className="eyebrow">Finans</p><h2>Ödeme ve tahsilat takibi zaman çizelgesi</h2></div><span className="read-only">Salt okunur</span></div>
        <p className="empty-inline" role="alert">Finans görünümü güvenli biçimde yüklenemedi. Diğer işletme verileri etkilenmedi.</p>
      </article>
    )
  }

  if (!timeline) return null

  const summary = timeline.summary
  const actionableDunning = timeline.items.filter((item) => (
    item.kind === 'dunning'
    && item.invoiceId !== null
    && (item.status === 'scheduled' || item.status === 'failed')
  ))
  const paidInvoices = timeline.items.filter((item) => item.kind === 'invoice' && item.status === 'paid')
  const refunds = timeline.items.filter((item) => item.kind === 'refund')
  return (
    <article className="panel billing-timeline-panel">
      <div className="panel-heading billing-heading">
        <div><p className="eyebrow">Finans</p><h2>Ödeme ve tahsilat takibi zaman çizelgesi</h2></div>
        <span className="read-only">Salt okunur</span>
      </div>
      <div className="billing-summary-grid">
        <div><span>Açık bakiye</span><strong>{formatMoney(summary.outstandingMinor, summary.currency)}</strong></div>
        <div><span>Açık fatura</span><strong>{summary.openInvoices}</strong></div>
        <div><span>Aktif takip</span><strong>{summary.activeDunning}</strong></div>
        <div><span>Mutabakat</span><strong>{summary.openReconciliation}</strong></div>
        <div><span>Başarısız deneme</span><strong>{summary.failedAttempts}</strong></div>
        <div><span>Toplam iade</span><strong>{formatMoney(summary.refundedMinor ?? 0, summary.currency)}</strong></div>
      </div>
      {timeline.items.length === 0 ? (
        <p className="empty-inline">Henüz ödeme kaydı yok.</p>
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
                    {refundAccessLabel(item) ? <span>{refundAccessLabel(item)}</span> : null}
                  </div>
                </div>
                <div className="timeline-result">
                  <span className="status" data-tone={itemTone(item)}>{billingStatusLabel(item.status)}</span>
                  {amount ? <strong>{amount}</strong> : null}
                </div>
              </div>
            )
          })}
        </div>
      )}
      <p className="billing-privacy-note">Ödeme sağlayıcı referansları, veri yükü, hata metni ve müşteri kişisel verileri bu görünümde yer almaz.</p>
      <div className="billing-intervention">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Denetimli müdahale</p>
            <h3>Ödeme takibi zamanlaması</h3>
          </div>
          <span className="read-only">Finans · Süper yönetici</span>
        </div>
        {actionableDunning.length === 0 ? (
          <p className="empty-inline">Müdahale edilebilir aktif ödeme takibi yok.</p>
        ) : (
          <form action={interveneTenantDunning} className="dunning-intervention-form">
            <input name="restaurantId" type="hidden" value={restaurantId} />
            <label className="reason-field">
              <span>Takip kaydı</span>
              <select name="invoiceId" required>
                {actionableDunning.map((item) => (
                  <option key={item.id} value={item.invoiceId ?? ''}>
                    Fatura …{item.invoiceId?.slice(-8)} · {ACTION_LABELS[item.action] ?? item.action} · {formatDate(item.nextActionAt)}
                  </option>
                ))}
              </select>
            </label>
            <div className="dunning-command-grid">
              <label className="reason-field">
                <span>Müdahale</span>
                <select defaultValue="retry_now" name="intervention">
                  <option value="retry_now">Şimdi yeniden sırala</option>
                  <option value="defer">Süreli erteleme</option>
                </select>
              </label>
              <label className="reason-field">
                <span>Erteleme süresi</span>
                <select defaultValue="7" name="deferDays">
                  <option value="1">1 gün</option>
                  <option value="3">3 gün</option>
                  <option value="7">7 gün</option>
                  <option value="14">14 gün</option>
                  <option value="30">30 gün</option>
                </select>
                <small>Yalnız “Süreli erteleme” seçildiğinde uygulanır.</small>
              </label>
            </div>
            <label className="reason-field">
              <span>İşlem gerekçesi</span>
              <textarea maxLength={1000} minLength={10} name="reason" placeholder="Müşteri iletişimi, onay veya operasyon gerekçesini yazın…" required />
              <small>İşlemi yapan kişi, önceki/yeni zamanlama ve işlem numarası değiştirilemez denetim kaydına yazılır.</small>
            </label>
            <div className="guarded-operation" role="note">
              <strong>Ödeme yetkisi değişmez</strong>
              <p>Bu işlem faturayı ödenmiş saymaz, paketi açmaz ve doğrudan tahsilat yapmaz. Yalnızca mevcut güvenli işlemin çalışma zamanını değiştirir; ödeme başarısını yine ödeme sağlayıcının imzalı bildirimi belirler.</p>
            </div>
            <div className="lifecycle-actions">
              <button className="button primary" type="submit">Müdahaleyi kaydet</button>
            </div>
          </form>
        )}
      </div>
      <div className="billing-intervention">
        <div className="panel-heading">
          <div><p className="eyebrow">Denetimli para hareketi</p><h3>Abonelik faturası iadesi</h3></div>
          <span className="read-only">Finans · Süper yönetici</span>
        </div>
        {paidInvoices.length === 0 ? <p className="empty-inline">İade edilebilir ödenmiş fatura görünmüyor.</p> : (
          <SubscriptionRefundForm paidInvoices={paidInvoices} refunds={refunds} restaurantId={restaurantId} />
        )}
      </div>
    </article>
  )
}
