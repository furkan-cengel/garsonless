/**
 * Canonical notification vocabulary for the durable notification system
 * (roadmap Faz 4). Browser-safe and pure: no database, provider or channel
 * implementation knowledge lives here. Delivery orchestration belongs to
 * `@garsonless/application`, persistence to `@garsonless/db`.
 */

export const NOTIFICATION_CATEGORIES = ['order', 'service_request', 'billing', 'system'] as const
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number]

export const NOTIFICATION_SEVERITIES = ['info', 'warning', 'critical'] as const
export type NotificationSeverity = (typeof NOTIFICATION_SEVERITIES)[number]

export const NOTIFICATION_CHANNELS = ['inapp', 'push', 'email', 'sms'] as const
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number]

export function isNotificationCategory(value: unknown): value is NotificationCategory {
  return NOTIFICATION_CATEGORIES.includes(value as NotificationCategory)
}

export function isNotificationSeverity(value: unknown): value is NotificationSeverity {
  return NOTIFICATION_SEVERITIES.includes(value as NotificationSeverity)
}

/**
 * ADR-0002/ADR-0003 rule: billing and platform/system notifications cannot be
 * muted by user preference — payment and service-interruption messages must
 * always reach the tenant. Operational categories are user-mutable.
 */
export function isMutableNotification(category: NotificationCategory, severity: NotificationSeverity): boolean {
  if (category === 'billing' || category === 'system') return false
  return severity !== 'critical'
}

/**
 * One durable dedupe identity per business occurrence. The inbox unique key
 * `(recipient, dedupe_key)` guarantees a redelivered/replayed event can never
 * produce a second entry for the same user.
 */
export function notificationDedupeKey(eventType: string, aggregateId: string): string {
  return `${eventType}:${aggregateId}`
}

/**
 * Per-user per-channel category preferences, stored as JSONB shaped
 * `{ inapp: {order: bool, ...}, email: {...} }`. Unknown shapes fall back to
 * the channel's defaults: in-app fails open (a corrupted row must never
 * black-hole operational notifications), while external channels like email
 * are opt-in for mutable categories — nobody gets surprise e-mails.
 */
export type NotificationChannelPrefs = Record<NotificationCategory, boolean>

export const NOTIFICATION_CHANNEL_DEFAULTS: Record<'inapp' | 'email', NotificationChannelPrefs> = {
  inapp: { order: true, service_request: true, billing: true, system: true },
  email: { order: false, service_request: false, billing: true, system: true },
}

export function readNotificationChannelPrefs(
  raw: unknown,
  channel: 'inapp' | 'email',
): NotificationChannelPrefs {
  const prefs: NotificationChannelPrefs = { ...NOTIFICATION_CHANNEL_DEFAULTS[channel] }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return prefs
  const channelPrefs = (raw as Record<string, unknown>)[channel]
  if (!channelPrefs || typeof channelPrefs !== 'object' || Array.isArray(channelPrefs)) return prefs
  for (const category of NOTIFICATION_CATEGORIES) {
    const value = (channelPrefs as Record<string, unknown>)[category]
    if (typeof value === 'boolean') prefs[category] = value
  }
  // Unmutable categories always deliver, whatever was stored.
  prefs.billing = true
  prefs.system = true
  return prefs
}

/** The single per-channel delivery decision: critical always lands; the rest follow prefs. */
export function shouldDeliverOnChannel(
  category: NotificationCategory,
  severity: NotificationSeverity,
  prefs: NotificationChannelPrefs,
): boolean {
  if (!isMutableNotification(category, severity)) return true
  return prefs[category]
}

// ── In-app compatibility wrappers (slice-1 vocabulary) ──────────────────────

export type NotificationInboxPrefs = NotificationChannelPrefs

export const DEFAULT_NOTIFICATION_INBOX_PREFS: NotificationInboxPrefs =
  NOTIFICATION_CHANNEL_DEFAULTS.inapp

export function readNotificationInboxPrefs(raw: unknown): NotificationInboxPrefs {
  return readNotificationChannelPrefs(raw, 'inapp')
}

export function shouldDeliverInApp(
  category: NotificationCategory,
  severity: NotificationSeverity,
  prefs: NotificationInboxPrefs,
): boolean {
  return shouldDeliverOnChannel(category, severity, prefs)
}
