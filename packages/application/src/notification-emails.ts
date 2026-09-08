import { emailAction, emailDetails, emailLineItems, emailParagraph, emailSteps, renderBrandEmail, type EmailTone } from '@garsonless/domain/email-brand'
import {
  readNotificationChannelPrefs,
  shouldDeliverOnChannel,
  type NotificationCategory,
  type NotificationSeverity,
} from '@garsonless/domain/notifications'
import { serviceRequestLabel } from '@garsonless/domain/tables'
import { err, ok, type Result } from '@garsonless/domain'
import {
  ADD_ON_DEFINITIONS,
  PLAN_DEFINITIONS,
  type RestaurantAddOn,
  type RestaurantPlan,
} from '@garsonless/domain/entitlements'
import {
  BILLING_NOTIFICATION_EVENT_TYPES,
  buildBillingNotificationContent,
  buildLifecycleNotificationContent,
  LIFECYCLE_NOTIFICATION_EVENT_TYPES,
  notificationDedupeKeyForEvent,
  type BillingNotificationEventType,
} from './notifications'

export const NOTIFICATION_EMAIL_CONSUMER = 'notification-email'
const NOTIFICATION_EMAIL_EVENT_TYPES = [
  'order.created',
  'service_request.created',
  ...LIFECYCLE_NOTIFICATION_EVENT_TYPES,
  ...BILLING_NOTIFICATION_EVENT_TYPES,
] as const
export type NotificationEmailEventType = (typeof NOTIFICATION_EMAIL_EVENT_TYPES)[number]

/** After this many provider attempts a delivery dead-letters instead of blocking the event. */
export const NOTIFICATION_EMAIL_MAX_ATTEMPTS = 5

export function isNotificationEmailEventType(value: string): value is NotificationEmailEventType {
  return (NOTIFICATION_EMAIL_EVENT_TYPES as readonly string[]).includes(value)
}

function emailCategoryForEvent(eventType: NotificationEmailEventType): NotificationCategory {
  if (eventType === 'order.created') return 'order'
  if (eventType === 'service_request.created') return 'service_request'
  if (eventType === 'onboarding.incomplete') return 'lifecycle'
  return eventType === 'billing.reconciliation_required' ? 'system' : 'billing'
}

function emailRecipientSection(eventType: NotificationEmailEventType): 'orders' | 'tables' | null {
  if (eventType === 'order.created') return 'orders'
  if (eventType === 'service_request.created') return 'tables'
  return null
}

export type NotificationEmailEvent = {
  id: string
  type: NotificationEmailEventType
  restaurantId: string
  aggregateId: string
  restaurantName: string
  tableLabel: string | null
  payload: Record<string, unknown>
}

export type NotificationEmailRecipient = {
  userId: string
  email: string | null
  /** Raw stored notification_preferences.prefs JSONB (or null when unset). */
  prefs: unknown
}

export type EmailTemplate = { subject: string; bodyHtml: string }

export type NotificationEmailRuntime = {
  /** Validated absolute dashboard origin supplied by the server runtime. */
  dashboardBaseUrl?: string
}

type NotificationEmailProviderResult =
  | { outcome: 'sent'; messageId: string | null }
  | { outcome: 'failed'; error: string }

export interface NotificationEmailProvider {
  send(input: { to: string; subject: string; html: string }): Promise<NotificationEmailProviderResult>
}

export interface NotificationEmailPort {
  loadEvent(eventId: string): Promise<Result<NotificationEmailEvent | null>>
  hasReceipt(eventId: string): Promise<Result<boolean>>
  listRecipients(input: {
    restaurantId: string
    /** null means owner-only for unmutable billing/system notices. */
    section: 'orders' | 'tables' | null
  }): Promise<Result<NotificationEmailRecipient[]>>
  /** Platform template override for (category, email); null falls back to code defaults. */
  loadTemplate(category: NotificationCategory): Promise<Result<EmailTemplate | null>>
  readDelivery(input: {
    recipientUserId: string
    dedupeKey: string
  }): Promise<Result<{ status: 'pending' | 'sent' | 'failed' | 'dead'; attempts: number } | null>>
  beginDelivery(input: {
    outboxId: string
    restaurantId: string
    recipientUserId: string
    category: NotificationCategory
    dedupeKey: string
    recipientAddress: string
    subject: string
    attempts: number
  }): Promise<Result<null>>
  completeDelivery(input: {
    recipientUserId: string
    dedupeKey: string
    status: 'sent' | 'failed' | 'dead'
    providerMessageId: string | null
    error: string | null
  }): Promise<Result<null>>
  recordReceipt(eventId: string): Promise<Result<null>>
}

// ── Templates ───────────────────────────────────────────────────────────────

export const DEFAULT_EMAIL_TEMPLATES: Record<NotificationCategory, EmailTemplate> = {
  order: {
    subject: 'masabu · {{restaurantName}} · Yeni sipariş ({{tableLabel}})',
    bodyHtml: emailParagraph('Yeni bir siparişiniz var. Ayrıntıları kontrol ederek hazırlığa başlayabilirsiniz.')
      + emailDetails([['İşletme', '{{restaurantName}}'], ['Masa', '{{tableLabel}}'], ['Sipariş tutarı', '{{total}}']]),
  },
  service_request: {
    subject: 'masabu · {{restaurantName}} · Masa isteği ({{tableLabel}})',
    bodyHtml: emailParagraph('Misafirinizin bir isteği var. İlgilendikten sonra isteği panodan kapatabilirsiniz.')
      + emailDetails([['İşletme', '{{restaurantName}}'], ['Masa', '{{tableLabel}}'], ['İstek', '{{requestLabel}}']]),
  },
  lifecycle: {
    subject: 'masabu · {{restaurantName}} · {{title}}',
    bodyHtml: emailParagraph('{{message}}') + emailDetails([['İşletme', '{{restaurantName}}']]),
  },
  billing: {
    subject: 'masabu · {{restaurantName}} · {{title}}',
    bodyHtml: emailParagraph('{{message}}') + emailDetails([['İşletme', '{{restaurantName}}']]),
  },
  system: {
    subject: 'masabu · {{restaurantName}} · {{title}}',
    bodyHtml: emailParagraph('{{message}}') + emailDetails([['İşletme', '{{restaurantName}}']]),
  },
}

export const FIRST_PAID_ACTIVATION_EMAIL_TEMPLATE: EmailTemplate = {
  subject: '{{restaurantName}} · masabu’ya hoş geldiniz',
  bodyHtml: emailParagraph('{{restaurantName}} için ücretli aboneliğiniz başarıyla etkinleştirildi. İşletmenizin bir sonraki adımında yanınızdayız.')
    + emailDetails([['Paket', '{{planLabel}} · {{billingIntervalLabel}}'], ['Ek hizmetler', '{{addOnLabels}}']])
    + emailParagraph('Faturanız hazır olduğunda fatura profilinizdeki e-posta adresine PDF olarak ayrıca gönderilecek.'),
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[char]!)
}

/** `{{key}}` substitution with HTML-escaped values; unknown keys render empty. */
export function renderEmailTemplate(template: EmailTemplate, vars: Record<string, string>): EmailTemplate {
  const substitute = (text: string, html: boolean) =>
    text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => html ? escapeHtml(vars[key] ?? '') : (vars[key] ?? ''))
  return { subject: substitute(template.subject, false).replace(/[\r\n]/g, ' '), bodyHtml: substitute(template.bodyHtml, true) }
}

function formatCurrency(value: unknown) {
  if (value === null || value === undefined || value === '') return ''
  const amount = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(amount)) return ''
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency', currency: 'TRY', maximumFractionDigits: 2,
  }).format(amount)
}

function welcomePlanLabel(value: unknown): string {
  if (typeof value !== 'string' || !(value in PLAN_DEFINITIONS)) return 'masabu'
  return PLAN_DEFINITIONS[value as RestaurantPlan].label
}

function welcomeAddOnLabels(value: unknown): string {
  if (!Array.isArray(value)) return 'Yok'
  const labels = value.flatMap((entry) => (
    typeof entry === 'string' && entry in ADD_ON_DEFINITIONS
      ? [ADD_ON_DEFINITIONS[entry as RestaurantAddOn].label]
      : []
  ))
  return labels.length > 0 ? labels.join(', ') : 'Yok'
}

function firstPaidActivation(event: NotificationEmailEvent): boolean {
  return event.type === 'invoice.paid' && event.payload['firstPaidActivation'] === true
}

function welcomeActionUrl(event: NotificationEmailEvent, runtime: NotificationEmailRuntime): string {
  const base = runtime.dashboardBaseUrl?.trim()
  if (!base) throw new Error('Notification email dashboard origin is required')
  const path = event.payload['onboardingComplete'] === true
    ? `/dashboard/${event.restaurantId}`
    : '/dashboard/onboarding'
  return new URL(path, base).toString()
}

export function buildEmailVars(
  event: NotificationEmailEvent,
  runtime: NotificationEmailRuntime = {},
): Record<string, string> {
  const base = {
    restaurantName: event.restaurantName,
    tableLabel: event.tableLabel ?? 'Masa',
  }
  if (event.type === 'order.created') {
    return { ...base, total: formatCurrency(event.payload['total']) }
  }
  if (event.type === 'service_request.created') {
    const requestType = typeof event.payload['requestType'] === 'string'
      ? event.payload['requestType']
      : 'waiter'
    return { ...base, requestLabel: serviceRequestLabel(requestType) }
  }
  if (event.type === 'onboarding.incomplete') {
    const content = buildLifecycleNotificationContent(event.type)
    return { ...base, title: content.title, message: content.body }
  }
  if (firstPaidActivation(event)) {
    return {
      ...base,
      planLabel: welcomePlanLabel(event.payload['plan']),
      billingIntervalLabel: event.payload['billingInterval'] === 'annual' ? 'Yıllık' : 'Aylık',
      addOnLabels: welcomeAddOnLabels(event.payload['addOns']),
      actionLabel: event.payload['onboardingComplete'] === true ? 'Panele git' : 'Kuruluma devam et',
      actionUrl: welcomeActionUrl(event, runtime),
    }
  }
  const content = buildBillingNotificationContent(
    event.type as BillingNotificationEventType,
    event.restaurantId,
  )
  return { ...base, title: content.title, message: content.body }
}

function notificationEmailDetails(event: NotificationEmailEvent): Array<[string, string]> {
  const payload = event.payload
  const rows: Array<[string, string]> = [['İşletme', event.restaurantName]]
  const plan = payload['plan']
  if (typeof plan === 'string' && plan in PLAN_DEFINITIONS) {
    const interval = payload['billingInterval'] === 'annual' ? ' · Yıllık' : payload['billingInterval'] === 'monthly' ? ' · Aylık' : ''
    rows.push(['Paket', `${welcomePlanLabel(plan)}${interval}`])
  }
  const minor = payload['amountMinor']
  if (payload['currency'] === 'TRY' && typeof minor === 'number' && Number.isSafeInteger(minor) && minor >= 0) {
    rows.push([event.type.startsWith('refund.') ? 'İade tutarı' : 'Tutar', formatCurrency(minor / 100)])
  }
  for (const [key, label] of [['periodEnd', event.type === 'invoice.upcoming' ? 'Yenileme tarihi' : 'Dönem sonu'], ['paidAt', 'Ödeme tarihi']] as const) {
    const value = payload[key]
    if (typeof value === 'string' && Number.isFinite(Date.parse(value))) rows.push([label, new Date(value).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' })])
  }
  if (typeof payload['invoiceId'] === 'string') rows.push(['Fatura referansı', payload['invoiceId']])
  if (typeof payload['refundId'] === 'string') rows.push(['İade referansı', payload['refundId']])
  if (payload['fiscalDocumentType'] === 'e_fatura') rows.push(['Belge türü', 'e-Fatura'])
  if (payload['fiscalDocumentType'] === 'e_arsiv') rows.push(['Belge türü', 'e-Arşiv Fatura'])
  return rows
}

const START_STEPS = [
  ['Menünüzü kontrol edin', 'Kategori, ürün ve fiyatlarınızı gözden geçirin.'],
  ['Masalarınızı hazırlayın', 'Masa QR kodlarınızı oluşturup yerleştirin.'],
  ['İşletme ayarlarınızı tamamlayın', 'Ödeme tercihlerinizi ve ekip erişimlerini paketinizin özelliklerine göre düzenleyin.'],
] as const

/** The final reference-based document is shared by delivery and the offline gallery. */
export function renderNotificationEmail(
  event: NotificationEmailEvent,
  runtime: NotificationEmailRuntime = {},
  override: EmailTemplate | null = null,
): EmailTemplate {
  const category = emailCategoryForEvent(event.type)
  const welcome = firstPaidActivation(event)
  const vars = buildEmailVars(event, runtime)
  const template = welcome ? FIRST_PAID_ACTIVATION_EMAIL_TEMPLATE : override ?? DEFAULT_EMAIL_TEMPLATES[category]
  const rendered = renderEmailTemplate(template, vars)
  const severity = emailSeverity(event)
  const operational = category === 'order' || category === 'service_request'
  const tone: EmailTone = welcome ? 'brand' : severity === 'critical' ? 'critical' : severity === 'warning' || operational || category === 'lifecycle' ? 'attention' : 'brand'
  const categories: Record<string, string> = {
    'order.created': 'Yeni sipariş', 'service_request.created': 'Masa çağrısı', 'onboarding.incomplete': 'Kuruluma devam edin',
    'invoice.payment_failed': 'İşlem gerekiyor', 'invoice.paid': 'Ödeme alındı', 'invoice.upcoming': 'Yaklaşan ödeme',
    'fiscal_document.ready': 'Resmî belge', 'refund.succeeded': 'İade tamamlandı', 'refund.requested': 'İade talebi',
    'subscription.cancelled': 'Abonelik sona erdi', 'subscription.cancellation_scheduled': 'İptal planlandı',
    'plan.changed': 'Paket değişikliği', 'tenant.suspended': 'Hizmet duraklatıldı',
    'subscription.trial_started': 'Denemeniz başladı', 'subscription.trial_expiring_3': '3 gün kaldı',
    'subscription.trial_expiring_7': '7 gün kaldı', 'subscription.trial_expiring_1': 'Son gün',
  }
  const title = welcome ? `${event.restaurantName}, masabu’ya hoş geldiniz`
    : category === 'order' ? `${vars['tableLabel']} sipariş verdi`
    : category === 'service_request' ? `${vars['tableLabel']} için yeni bir istek var`
    : vars['title'] ?? 'Hesabınızla ilgili bir güncelleme var'
  let bodyHtml = rendered.bodyHtml
  if (!override && !welcome) {
    if (category === 'order') {
      bodyHtml = emailParagraph('Sipariş panele düştü. Ayrıntıları kontrol ederek hazırlamaya başlayabilirsiniz.')
        + emailDetails([['İşletme', event.restaurantName], ['Masa', vars['tableLabel']!]])
        + (vars['total'] ? emailLineItems([], vars['total'], 'Sipariş toplamı') : '')
    } else if (category === 'service_request') {
      bodyHtml = emailParagraph('Misafiriniz menüden bir istek bıraktı. İlgilendikten sonra isteği panelden kapatabilirsiniz.')
        + emailDetails([['Masa', vars['tableLabel']!], ['Talep', vars['requestLabel']!]])
    } else {
      bodyHtml = emailParagraph(vars['message']!) + emailDetails(notificationEmailDetails(event))
      if (category === 'lifecycle' || event.type === 'subscription.trial_started') bodyHtml += emailSteps(START_STEPS)
    }
  }
  if (welcome) bodyHtml += emailSteps(START_STEPS)
  if (!override || welcome) {
    const path = category === 'order' ? `/dashboard/${event.restaurantId}/orders`
      : category === 'service_request' ? `/dashboard/${event.restaurantId}/tables`
      : category === 'lifecycle' ? '/dashboard/onboarding'
      : `/dashboard/${event.restaurantId}/settings?section=billing`
    const label = vars['actionLabel'] ?? (category === 'order' ? 'Siparişi panelde aç' : category === 'service_request' ? 'Çağrıyı panelde aç' : category === 'lifecycle' ? 'Kurulumu tamamla' : event.type === 'invoice.payment_failed' ? 'Ödeme yöntemini güncelle' : event.type.startsWith('subscription.trial') ? 'Paketleri incele' : event.type === 'fiscal_document.ready' ? 'Faturalarımı aç' : 'Faturalandırmayı yönet')
    if (welcome) bodyHtml += emailAction(label, vars['actionUrl']!)
    else if (runtime.dashboardBaseUrl) bodyHtml += emailAction(label, new URL(path, runtime.dashboardBaseUrl).toString())
  }
  return {
    subject: rendered.subject,
    bodyHtml: renderBrandEmail({
      headerLabel: operational ? event.restaurantName : category === 'lifecycle' || welcome ? 'Başlangıç' : category === 'billing' ? 'Faturalandırma' : 'Hesap',
      category: welcome ? 'Hoş geldiniz' : categories[event.type] ?? 'Abonelik bildirimi',
      tone,
      ...(!override || welcome ? { title } : {}),
      preheader: vars['message'] ?? `${event.restaurantName} · ${title}`,
      bodyHtml,
      ...(runtime.dashboardBaseUrl && operational ? { notificationSettingsUrl: new URL(`/dashboard/${event.restaurantId}/settings?section=notifications`, runtime.dashboardBaseUrl).toString() } : {}),
      footer: operational ? 'Sipariş ve masa bildirimlerini Ayarlar → Bildirimler bölümünden yönetebilirsiniz.' : category === 'lifecycle' ? 'Kurulum ekranından kaldığınız yerden devam edebilirsiniz.' : 'Abonelik ve fatura ayrıntılarınızı Ayarlar → Faturalandırma bölümünden takip edebilirsiniz.',
    }),
  }
}

// ── Consumption ─────────────────────────────────────────────────────────────

export type NotificationEmailConsumption = {
  duplicate: boolean
  recipients: number
  sent: number
  muted: number
  dead: number
}

function emailSeverity(event: NotificationEmailEvent): NotificationSeverity {
  if (event.type === 'order.created' || event.type === 'service_request.created') return 'info'
  if (event.type === 'onboarding.incomplete') return buildLifecycleNotificationContent(event.type).severity
  return buildBillingNotificationContent(event.type as BillingNotificationEventType, event.restaurantId).severity
}

/**
 * Durable per-recipient e-mail fan-out. Delivery state machine per recipient:
 * `sent`/`dead` are terminal; a `failed` row retries with attempts+1 until
 * NOTIFICATION_EMAIL_MAX_ATTEMPTS, then dead-letters. Transient provider
 * failures return err WITHOUT a receipt so the outbox retries the event with
 * its own backoff; once every remaining delivery is terminal the receipt
 * records and the event completes.
 */
export async function consumeNotificationEmail(
  eventId: string,
  port: NotificationEmailPort,
  provider: NotificationEmailProvider,
  runtime: NotificationEmailRuntime = {},
): Promise<Result<NotificationEmailConsumption>> {
  const receipt = await port.hasReceipt(eventId)
  if (!receipt.ok) return receipt
  if (receipt.value) return ok({ duplicate: true, recipients: 0, sent: 0, muted: 0, dead: 0 })

  const loaded = await port.loadEvent(eventId)
  if (!loaded.ok) return loaded
  if (!loaded.value) return err('Notification email event not found or unsupported')
  const event = loaded.value

  if (
    (event.type === 'order.created' && event.payload['source'] !== 'customer')
    || (event.type === 'service_request.created' && event.payload['reminder'] === true)
  ) {
    const recorded = await port.recordReceipt(eventId)
    return recorded.ok
      ? ok({ duplicate: false, recipients: 0, sent: 0, muted: 0, dead: 0 })
      : recorded
  }

  const recipients = await port.listRecipients({
    restaurantId: event.restaurantId,
    section: emailRecipientSection(event.type),
  })
  if (!recipients.ok) return recipients

  const category = emailCategoryForEvent(event.type)
  const severity = emailSeverity(event)
  const override = await port.loadTemplate(category)
  if (!override.ok) return override
  const rendered = renderNotificationEmail(event, runtime, override.value)
  const dedupeKey = notificationDedupeKeyForEvent(event)

  let sent = 0
  let muted = 0
  let dead = 0
  const failures: string[] = []

  for (const recipient of recipients.value) {
    const prefs = readNotificationChannelPrefs(recipient.prefs, 'email')
    if (!recipient.email || !shouldDeliverOnChannel(category, severity, prefs)) {
      muted += 1
      continue
    }

    const current = await port.readDelivery({ recipientUserId: recipient.userId, dedupeKey })
    if (!current.ok) return current
    if (current.value?.status === 'sent') { sent += 1; continue }
    if (current.value?.status === 'dead') { dead += 1; continue }

    const attempts = (current.value?.attempts ?? 0) + 1
    if (attempts > NOTIFICATION_EMAIL_MAX_ATTEMPTS) {
      const deadened = await port.completeDelivery({
        recipientUserId: recipient.userId,
        dedupeKey,
        status: 'dead',
        providerMessageId: null,
        error: 'Retry budget exhausted',
      })
      if (!deadened.ok) return deadened
      dead += 1
      continue
    }

    const begun = await port.beginDelivery({
      outboxId: event.id,
      restaurantId: event.restaurantId,
      recipientUserId: recipient.userId,
      category,
      dedupeKey,
      recipientAddress: recipient.email,
      subject: rendered.subject,
      attempts,
    })
    if (!begun.ok) return begun

    const result = await provider.send({
      to: recipient.email,
      subject: rendered.subject,
      html: rendered.bodyHtml,
    })
    const completed = await port.completeDelivery({
      recipientUserId: recipient.userId,
      dedupeKey,
      status: result.outcome,
      providerMessageId: result.outcome === 'sent' ? result.messageId : null,
      error: result.outcome === 'sent' ? null : result.error,
    })
    if (!completed.ok) return completed

    if (result.outcome === 'sent') sent += 1
    else failures.push(result.error)
  }

  if (failures.length > 0) return err(`Notification email delivery failed: ${failures.join('; ')}`)
  const recorded = await port.recordReceipt(eventId)
  return recorded.ok
    ? ok({ duplicate: false, recipients: recipients.value.length, sent, muted, dead })
    : recorded
}
