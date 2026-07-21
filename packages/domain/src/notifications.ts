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
 * Per-user in-app category preferences, stored as JSONB. Unknown shapes
 * fail-open to "deliver": a corrupted preference row must never silently
 * black-hole operational notifications.
 */
export type NotificationInboxPrefs = Record<NotificationCategory, boolean>

export const DEFAULT_NOTIFICATION_INBOX_PREFS: NotificationInboxPrefs = {
  order: true,
  service_request: true,
  billing: true,
  system: true,
}

export function readNotificationInboxPrefs(raw: unknown): NotificationInboxPrefs {
  const prefs: NotificationInboxPrefs = { ...DEFAULT_NOTIFICATION_INBOX_PREFS }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return prefs
  const inapp = (raw as Record<string, unknown>)['inapp']
  if (!inapp || typeof inapp !== 'object' || Array.isArray(inapp)) return prefs
  for (const category of NOTIFICATION_CATEGORIES) {
    const value = (inapp as Record<string, unknown>)[category]
    if (typeof value === 'boolean') prefs[category] = value
  }
  // Unmutable categories always deliver, whatever was stored.
  prefs.billing = true
  prefs.system = true
  return prefs
}

/** The single in-app delivery decision: critical always lands; the rest follow prefs. */
export function shouldDeliverInApp(
  category: NotificationCategory,
  severity: NotificationSeverity,
  prefs: NotificationInboxPrefs,
): boolean {
  if (!isMutableNotification(category, severity)) return true
  return prefs[category]
}
