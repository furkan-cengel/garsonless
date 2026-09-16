import {
  notificationDedupeKey,
  readNotificationInboxPrefs,
  shouldDeliverInApp,
  type NotificationCategory,
  type NotificationSeverity,
} from '@garsonless/domain/notifications'
import { serviceRequestLabel } from '@garsonless/domain/tables'
import { err, ok, type Result } from '@garsonless/domain'

export const DASHBOARD_INBOX_CONSUMER = 'dashboard-inbox'
export const BILLING_NOTIFICATION_EVENT_TYPES = [
  'subscription.trial_started',
  'subscription.trial_expiring_7',
  'subscription.trial_expiring_3',
  'subscription.trial_expiring_1',
  'subscription.trial_expired',
  'invoice.upcoming',
  'subscription.cancellation_scheduled',
  'subscription.cancellation_withdrawn',
  'subscription.cancelled',
  'invoice.payment_failed',
  'billing.retry_requested',
  'billing.warning_3',
  'billing.warning_7',
  'billing.reconciliation_required',
  'invoice.paid',
  'plan.change_scheduled',
  'plan.changed',
  'payment_method.updated',
  'refund.requested',
  'refund.succeeded',
  'refund.failed',
  'fiscal_document.ready',
  'tenant.suspended',
  'tenant.reactivated',
] as const
export type BillingNotificationEventType = (typeof BILLING_NOTIFICATION_EVENT_TYPES)[number]

export const LIFECYCLE_NOTIFICATION_EVENT_TYPES = ['onboarding.incomplete'] as const
export type LifecycleNotificationEventType = (typeof LIFECYCLE_NOTIFICATION_EVENT_TYPES)[number]

export const DASHBOARD_INBOX_EVENT_TYPES = [
  'order.created',
  'service_request.created',
  ...LIFECYCLE_NOTIFICATION_EVENT_TYPES,
  ...BILLING_NOTIFICATION_EVENT_TYPES,
] as const
export type DashboardInboxEventType = (typeof DASHBOARD_INBOX_EVENT_TYPES)[number]

export function isDashboardInboxEventType(value: string): value is DashboardInboxEventType {
  return (DASHBOARD_INBOX_EVENT_TYPES as readonly string[]).includes(value)
}

export type DashboardInboxEvent = {
  id: string
  type: DashboardInboxEventType
  restaurantId: string
  aggregateId: string
  tableLabel: string | null
  payload: Record<string, unknown>
}

export type DashboardInboxRecipient = {
  userId: string
  /** Raw stored notification_preferences.prefs JSONB (or null when unset). */
  prefs: unknown
}

export type DashboardInboxEntry = {
  restaurantId: string
  recipientUserId: string
  outboxId: string
  category: NotificationCategory
  severity: NotificationSeverity
  title: string
  body: string
  linkPath: string
  dedupeKey: string
}

export interface DashboardInboxPort {
  loadEvent(eventId: string): Promise<Result<DashboardInboxEvent | null>>
  hasReceipt(eventId: string): Promise<Result<boolean>>
  /** Owner + active members holding the section that matches the event. */
  listRecipients(input: {
    restaurantId: string
    /** null means owner-only (mandatory billing/system communication). */
    section: 'orders' | 'tables' | null
  }): Promise<Result<DashboardInboxRecipient[]>>
  /** Idempotent: conflicting (recipient, dedupe_key) rows are silently skipped. */
  insertEntries(entries: DashboardInboxEntry[]): Promise<Result<null>>
  recordReceipt(eventId: string): Promise<Result<null>>
}

export function inboxCategoryForEvent(eventType: DashboardInboxEventType): NotificationCategory {
  if (eventType === 'order.created') return 'order'
  if (eventType === 'service_request.created') return 'service_request'
  if (eventType === 'onboarding.incomplete') return 'lifecycle'
  return eventType === 'billing.reconciliation_required' ? 'system' : 'billing'
}

export function inboxRecipientSection(eventType: DashboardInboxEventType): 'orders' | 'tables' | null {
  if (eventType === 'order.created') return 'orders'
  if (eventType === 'service_request.created') return 'tables'
  return null
}

export function buildLifecycleNotificationContent(
  eventType: LifecycleNotificationEventType,
): { title: string; body: string; linkPath: string; severity: NotificationSeverity } {
  if (eventType === 'onboarding.incomplete') {
    return {
      title: 'İşletme kurulumunu tamamlayın',
      body: 'Menünüzü ve görünümünüzü tamamlayarak işletmenizi yayına hazırlayabilirsiniz.',
      linkPath: '/dashboard/onboarding',
      severity: 'info',
    }
  }
  return eventType satisfies never
}

function formatCurrency(value: unknown) {
  const amount = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(amount)) return null
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency', currency: 'TRY', maximumFractionDigits: 2,
  }).format(amount)
}

export function buildInboxContent(event: DashboardInboxEvent): {
  title: string
  body: string
  linkPath: string
  severity: NotificationSeverity
} {
  const tableLabel = event.tableLabel ?? 'Masa'
  if (event.type === 'order.created') {
    return {
      title: 'Yeni sipariş',
      body: [tableLabel, formatCurrency(event.payload['total'])].filter(Boolean).join(' · '),
      linkPath: `/dashboard/${event.restaurantId}/orders`,
      severity: 'info',
    }
  }
  if (event.type === 'service_request.created') {
    const requestType = typeof event.payload['requestType'] === 'string'
      ? event.payload['requestType']
      : 'waiter'
    return {
      title: 'Masa isteği',
      body: `${tableLabel} · ${serviceRequestLabel(requestType)}`,
      linkPath: `/dashboard/${event.restaurantId}/tables`,
      severity: 'info',
    }
  }
  if (event.type === 'onboarding.incomplete') {
    return buildLifecycleNotificationContent(event.type)
  }
  return buildBillingNotificationContent(event.type, event.restaurantId)
}

export function buildBillingNotificationContent(
  eventType: BillingNotificationEventType,
  restaurantId: string,
): { title: string; body: string; linkPath: string; severity: NotificationSeverity } {
  const linkPath = `/dashboard/${restaurantId}/settings?section=billing`
  const content: Record<BillingNotificationEventType, { title: string; body: string; severity: NotificationSeverity }> = {
    'subscription.trial_started': { title: '14 günlük Pro denemeniz başladı', body: 'Deneme sürenizde Pro özelliklerini kullanabilir, faturalama bölümünden dilediğiniz zaman paket seçebilirsiniz.', severity: 'info' },
    'subscription.trial_expiring_7': { title: 'Deneme sürenizin bitmesine 7 gün kaldı', body: 'Kesintisiz devam etmek için işletmenize uygun paketi seçin.', severity: 'info' },
    'subscription.trial_expiring_3': { title: 'Deneme sürenizin bitmesine 3 gün kaldı', body: 'Pro özelliklerini kullanmaya devam etmek için paketinizi ve ödeme bilgilerinizi tamamlayın.', severity: 'warning' },
    'subscription.trial_expiring_1': { title: 'Deneme sürenizin son günü', body: 'Ücretli özelliklerin kapanmaması için bugün bir paket seçip ödemenizi tamamlayın.', severity: 'critical' },
    'subscription.trial_expired': { title: 'Pro deneme süreniz sona erdi', body: 'Verileriniz korunuyor. Ücretli özellikleri yeniden açmak için bir paket seçebilirsiniz.', severity: 'critical' },
    'invoice.upcoming': { title: 'Abonelik yenilemeniz yaklaşıyor', body: 'Yeni dönem ödemeniz yaklaşıyor. Kart ve fatura bilgilerinizi kontrol edin.', severity: 'info' },
    'subscription.cancellation_scheduled': { title: 'Abonelik iptaliniz planlandı', body: 'Planınız ve ücretli özellikleriniz mevcut dönem sonuna kadar açık kalacak. İptal talebini işlem başlamadan önce geri alabilirsiniz.', severity: 'warning' },
    'subscription.cancellation_withdrawn': { title: 'Abonelik iptaliniz geri alındı', body: 'Aboneliğiniz ve dönemsel yenilemeleriniz devam edecek.', severity: 'info' },
    'subscription.cancelled': { title: 'Aboneliğiniz sona erdi', body: 'Dönem sonu iptaliniz tamamlandı. Verileriniz korunurken ücretli özellikler kapatıldı.', severity: 'critical' },
    'invoice.payment_failed': { title: 'Abonelik ödemesi alınamadı', body: 'Ödeme yönteminizi kontrol edin. Hizmetiniz şimdilik açık kalmaya devam ediyor.', severity: 'warning' },
    'billing.retry_requested': { title: 'Ödeme yeniden deneniyor', body: 'Abonelik ödemeniz otomatik olarak yeniden işleme alındı.', severity: 'warning' },
    'billing.warning_3': { title: 'Ödeme gecikmesi devam ediyor', body: 'Kesinti yaşamamak için faturalama bilgilerinizi gözden geçirin.', severity: 'warning' },
    'billing.warning_7': { title: 'Son ödeme uyarısı', body: 'Ödeme tamamlanmazsa hizmetiniz geçici olarak duraklatılacak.', severity: 'critical' },
    'billing.reconciliation_required': { title: 'Ödeme durumu kontrol ediliyor', body: 'Kesinleşmemiş bir ödeme işlemini güvenli biçimde inceliyoruz. Aynı işlemi tekrar başlatmayın.', severity: 'warning' },
    'invoice.paid': { title: 'Abonelik ödemeniz alındı', body: 'Ödemeniz başarıyla kaydedildi.', severity: 'info' },
    'plan.change_scheduled': { title: 'Abonelik değişikliğiniz planlandı', body: 'Plan ve eklenti seçiminiz bir sonraki başarılı yenileme ödemesiyle etkinleşecek.', severity: 'info' },
    'plan.changed': { title: 'Abonelik değişikliğiniz tamamlandı', body: 'Plan ve eklenti seçiminiz ödemenizle birlikte güncellendi.', severity: 'info' },
    'payment_method.updated': { title: 'Ödeme yönteminiz güncellendi', body: 'Aboneliğinizde kullanılacak kart İyzico üzerinden güvenle güncellendi.', severity: 'info' },
    'refund.requested': { title: 'Abonelik iadeniz işleme alındı', body: 'Abonelik faturanız için iade talebi oluşturuldu. İade sonucu kesinleştiğinde ayrıca bilgilendirileceksiniz.', severity: 'info' },
    'refund.succeeded': { title: 'Abonelik iadeniz tamamlandı', body: 'İadeniz ödeme sağlayıcı tarafından onaylandı. Bankanıza göre kartınıza yansıma süresi değişebilir.', severity: 'info' },
    'refund.failed': { title: 'Abonelik iadeniz tamamlanamadı', body: 'İade talebi ödeme sağlayıcı tarafından tamamlanamadı. Destek ekibimizle iletişime geçebilirsiniz.', severity: 'warning' },
    'fiscal_document.ready': { title: 'Faturanız hazır', body: 'Mali belgeniz oluşturuldu ve fatura profilinizdeki e-posta adresine güvenli biçimde gönderildi.', severity: 'info' },
    'tenant.suspended': { title: 'Hizmet geçici olarak duraklatıldı', body: 'Yeni sipariş alımı durduruldu. Ödeme tamamlandığında hizmetiniz otomatik olarak açılacak.', severity: 'critical' },
    'tenant.reactivated': { title: 'Hizmetiniz yeniden etkinleştirildi', body: 'Ödemeniz alındı ve yeni sipariş alımı tekrar açıldı.', severity: 'info' },
  }
  return { ...content[eventType], linkPath }
}

/** Periodic events need an occurrence identity beyond their long-lived aggregate. */
export function notificationDedupeKeyForEvent(event: {
  type: string
  aggregateId: string
  payload: Record<string, unknown>
}): string {
  const periodEnd = event.type === 'invoice.upcoming' && typeof event.payload['periodEnd'] === 'string'
    ? event.payload['periodEnd']
    : null
  const reminderHour = event.type === 'onboarding.incomplete'
    && typeof event.payload['reminderHour'] === 'number'
    ? String(event.payload['reminderHour'])
    : null
  const occurrence = periodEnd ?? reminderHour
  return notificationDedupeKey(event.type, occurrence ? `${event.aggregateId}:${occurrence}` : event.aggregateId)
}

export type DashboardInboxConsumption = {
  duplicate: boolean
  recipients: number
  delivered: number
  muted: number
}

/**
 * Durable fan-out from one outbox event to per-user inbox entries.
 * Receipt-first + a per-recipient dedupe key make the whole consumption
 * replay-safe: a crashed run resumes without duplicating entries.
 */
export async function consumeDashboardInbox(
  eventId: string,
  port: DashboardInboxPort,
): Promise<Result<DashboardInboxConsumption>> {
  const receipt = await port.hasReceipt(eventId)
  if (!receipt.ok) return receipt
  if (receipt.value) return ok({ duplicate: true, recipients: 0, delivered: 0, muted: 0 })

  const loaded = await port.loadEvent(eventId)
  if (!loaded.ok) return loaded
  if (!loaded.value) return err('Dashboard inbox event not found or unsupported')
  const event = loaded.value

  if (
    (event.type === 'order.created' && event.payload['source'] !== 'customer')
    || (event.type === 'service_request.created' && event.payload['reminder'] === true)
  ) {
    const recorded = await port.recordReceipt(eventId)
    return recorded.ok
      ? ok({ duplicate: false, recipients: 0, delivered: 0, muted: 0 })
      : recorded
  }

  const recipients = await port.listRecipients({
    restaurantId: event.restaurantId,
    section: inboxRecipientSection(event.type),
  })
  if (!recipients.ok) return recipients

  const category = inboxCategoryForEvent(event.type)
  const content = buildInboxContent(event)
  const dedupeKey = notificationDedupeKeyForEvent(event)

  const entries: DashboardInboxEntry[] = []
  let muted = 0
  for (const recipient of recipients.value) {
    const prefs = readNotificationInboxPrefs(recipient.prefs)
    if (!shouldDeliverInApp(category, content.severity, prefs)) {
      muted += 1
      continue
    }
    entries.push({
      restaurantId: event.restaurantId,
      recipientUserId: recipient.userId,
      outboxId: event.id,
      category,
      severity: content.severity,
      title: content.title,
      body: content.body,
      linkPath: content.linkPath,
      dedupeKey,
    })
  }

  if (entries.length > 0) {
    const inserted = await port.insertEntries(entries)
    if (!inserted.ok) return inserted
  }

  const recorded = await port.recordReceipt(eventId)
  return recorded.ok
    ? ok({ duplicate: false, recipients: recipients.value.length, delivered: entries.length, muted })
    : recorded
}
