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
  'invoice.payment_failed',
  'billing.retry_requested',
  'billing.warning_3',
  'billing.warning_7',
  'billing.reconciliation_required',
  'invoice.paid',
  'tenant.suspended',
  'tenant.reactivated',
] as const
export type BillingNotificationEventType = (typeof BILLING_NOTIFICATION_EVENT_TYPES)[number]

export const DASHBOARD_INBOX_EVENT_TYPES = [
  'order.created',
  'service_request.created',
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
  return eventType === 'billing.reconciliation_required' ? 'system' : 'billing'
}

export function inboxRecipientSection(eventType: DashboardInboxEventType): 'orders' | 'tables' | null {
  if (eventType === 'order.created') return 'orders'
  if (eventType === 'service_request.created') return 'tables'
  return null
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
  return buildBillingNotificationContent(event.type, event.restaurantId)
}

export function buildBillingNotificationContent(
  eventType: BillingNotificationEventType,
  restaurantId: string,
): { title: string; body: string; linkPath: string; severity: NotificationSeverity } {
  const linkPath = `/dashboard/${restaurantId}/settings?section=billing`
  const content: Record<BillingNotificationEventType, { title: string; body: string; severity: NotificationSeverity }> = {
    'invoice.payment_failed': { title: 'Abonelik ödemesi alınamadı', body: 'Ödeme yönteminizi kontrol edin. Hizmetiniz şimdilik açık kalmaya devam ediyor.', severity: 'warning' },
    'billing.retry_requested': { title: 'Ödeme yeniden deneniyor', body: 'Abonelik ödemeniz otomatik olarak yeniden işleme alındı.', severity: 'warning' },
    'billing.warning_3': { title: 'Ödeme gecikmesi devam ediyor', body: 'Kesinti yaşamamak için faturalama bilgilerinizi gözden geçirin.', severity: 'warning' },
    'billing.warning_7': { title: 'Son ödeme uyarısı', body: 'Ödeme tamamlanmazsa hizmetiniz geçici olarak duraklatılacak.', severity: 'critical' },
    'billing.reconciliation_required': { title: 'Ödeme durumu kontrol ediliyor', body: 'Kesinleşmemiş bir ödeme işlemini güvenli biçimde inceliyoruz. Aynı işlemi tekrar başlatmayın.', severity: 'warning' },
    'invoice.paid': { title: 'Abonelik ödemeniz alındı', body: 'Ödemeniz başarıyla kaydedildi.', severity: 'info' },
    'tenant.suspended': { title: 'Hizmet geçici olarak duraklatıldı', body: 'Yeni sipariş alımı durduruldu. Ödeme tamamlandığında hizmetiniz otomatik olarak açılacak.', severity: 'critical' },
    'tenant.reactivated': { title: 'Hizmetiniz yeniden etkinleştirildi', body: 'Ödemeniz alındı ve yeni sipariş alımı tekrar açıldı.', severity: 'info' },
  }
  return { ...content[eventType], linkPath }
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
  const dedupeKey = notificationDedupeKey(event.type, event.aggregateId)

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
