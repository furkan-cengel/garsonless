'use server'

import { createDashboardServerClient } from '../supabase-server'
import { assertMember } from '../auth/access'
import { serviceRequestLabel } from '@garsonless/domain/tables'
import type { DashboardActionFailure } from '../server-action-error'
import { dashboardAccessFailure, dashboardActionFailure } from '../server-action-error'

async function getAuthUser() {
  const supabase = await createDashboardServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

export interface NotificationItem {
  id: string
  type: 'waiter' | 'order'
  title: string
  subtitle: string
  createdAt: string
  /** Present for waiter-call items (resolvable). */
  requestId: string | null
}

const ORDER_NOTIF_STATUSES = ['pending', 'pending_approval', 'ready']

/** Live notification feed merged from pending waiter calls + recent active orders. */
export async function getNotifications(
  restaurantId: string,
): Promise<NotificationItem[] | DashboardActionFailure> {
  const { supabase, user } = await getAuthUser()
  if (!user) return dashboardAccessFailure('Not authenticated', 'notifications.feed')

  const gate = await assertMember(restaurantId)
  if ('error' in gate) return dashboardAccessFailure(gate.error, 'notifications.feed')

  const twoHoursAgo = new Date(Date.now() - 2 * 3_600_000).toISOString()

  const [reqRes, tablesRes, ordersRes] = await Promise.all([
    supabase
      .from('service_requests')
      .select('id, table_id, created_at, request_type')
      .eq('restaurant_id', restaurantId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
    supabase
      .from('tables')
      .select('id, label')
      .eq('restaurant_id', restaurantId)
      .is('deleted_at', null),
    supabase
      .from('orders')
      .select('id, status, total, table_id, created_at')
      .eq('restaurant_id', restaurantId)
      .in('status', ORDER_NOTIF_STATUSES)
      .gte('created_at', twoHoursAgo)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const queryError = reqRes.error ?? tablesRes.error ?? ordersRes.error
  if (queryError) {
    return dashboardActionFailure('SERVICE_UNAVAILABLE', {
      operation: 'notifications.feed',
      message: 'Bildirimler şu anda yüklenemiyor. Lütfen tekrar deneyin.',
      cause: queryError,
    })
  }

  const labels: Record<string, string> = {}
  for (const t of (tablesRes.data ?? []) as Array<{ id: string; label: string }>) {
    labels[t.id] = t.label
  }

  const waiterItems: NotificationItem[] = (
    (reqRes.data ?? []) as Array<{
      id: string
      table_id: string
      created_at: string
      request_type: string
    }>
  ).map((r) => ({
    id: `req-${r.id}`,
    type: 'waiter',
    title: `${labels[r.table_id] ?? 'Masa'} · ${serviceRequestLabel(r.request_type)}`,
    subtitle: 'Masa isteği bekliyor',
    createdAt: r.created_at,
    requestId: r.id,
  }))

  const orderItems: NotificationItem[] = (
    (ordersRes.data ?? []) as Array<{
      id: string; status: string; total: number; table_id: string | null; created_at: string
    }>
  ).map((o) => {
    const where = o.table_id ? (labels[o.table_id] ?? 'Masa') : 'Gel-al'
    const ready = o.status === 'ready'
    return {
      id: `order-${o.id}`,
      type: 'order' as const,
      title: ready ? `${where} · servise hazır` : `${where} · yeni sipariş`,
      subtitle: `₺${Number(o.total).toLocaleString('tr-TR')}`,
      createdAt: o.created_at,
      requestId: null,
    }
  })

  return [...waiterItems, ...orderItems].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

// ── Durable per-user inbox (notification_inbox) ─────────────────────────────
// Written by the outbox `dashboard-inbox` consumer; read here scoped to the
// authenticated user. The service-role reads always filter by the resolved
// auth user id — RLS own-user select is defense in depth.

export interface InboxNotificationItem {
  id: string
  category: string
  severity: string
  title: string
  body: string
  linkPath: string | null
  readAt: string | null
  createdAt: string
}

export interface InboxFeed {
  items: InboxNotificationItem[]
  unread: number
}

export async function getInboxFeed(
  restaurantId: string,
): Promise<InboxFeed | DashboardActionFailure> {
  const { user } = await getAuthUser()
  if (!user) return dashboardAccessFailure('Not authenticated', 'notifications.inbox')

  const gate = await assertMember(restaurantId)
  if ('error' in gate) return dashboardAccessFailure(gate.error, 'notifications.inbox')

  const { listInboxNotifications, countUnreadInboxNotifications } = await import('@garsonless/db/server')
  const [listed, unread] = await Promise.all([
    listInboxNotifications({ restaurantId, userId: user.id }),
    countUnreadInboxNotifications({ restaurantId, userId: user.id }),
  ])
  if (!listed.ok || !unread.ok) {
    return dashboardActionFailure('SERVICE_UNAVAILABLE', {
      operation: 'notifications.inbox',
      message: 'Bildirimler şu anda yüklenemiyor. Lütfen tekrar deneyin.',
      cause: !listed.ok ? listed.error : (!unread.ok ? unread.error : null),
    })
  }
  return { items: listed.value, unread: unread.value }
}

export async function getUnreadInboxCount(
  restaurantId: string,
  categories?: string[],
): Promise<{ unread: number } | DashboardActionFailure> {
  const { user } = await getAuthUser()
  if (!user) return dashboardAccessFailure('Not authenticated', 'notifications.inbox-count')

  const gate = await assertMember(restaurantId)
  if ('error' in gate) return dashboardAccessFailure(gate.error, 'notifications.inbox-count')

  const { countUnreadInboxNotifications } = await import('@garsonless/db/server')
  const unread = await countUnreadInboxNotifications({ restaurantId, userId: user.id, categories })
  if (!unread.ok) {
    return dashboardActionFailure('SERVICE_UNAVAILABLE', {
      operation: 'notifications.inbox-count',
      message: 'Bildirim sayacı yüklenemedi.',
      cause: unread.error,
    })
  }
  return { unread: unread.value }
}

export interface DashboardInboxSyncResult {
  unread: number
  consumed: number
  failed: number
}

/**
 * Self-healing fallback for optional inbox fan-out. The outbox worker remains
 * primary; an authenticated dashboard Realtime event repairs only its matching
 * aggregate when a local/unavailable callback caused fan-out to be skipped.
 */
export async function syncDashboardInboxEvent(
  restaurantId: string,
  aggregateId: string,
): Promise<DashboardInboxSyncResult | DashboardActionFailure> {
  const { user } = await getAuthUser()
  if (!user) return dashboardAccessFailure('Not authenticated', 'notifications.inbox-sync')

  const gate = await assertMember(restaurantId)
  if ('error' in gate) return dashboardAccessFailure(gate.error, 'notifications.inbox-sync')

  const [{ consumeDashboardInbox }, {
    countUnreadInboxNotifications,
    createDashboardInboxPort,
    listPendingDashboardInboxEventIds,
  }] = await Promise.all([
    import('@garsonless/application/notifications'),
    import('@garsonless/db/server'),
  ])

  const pending = await listPendingDashboardInboxEventIds({
    restaurantId,
    aggregateId,
    limit: 5,
  })
  if (!pending.ok) {
    return dashboardActionFailure('SERVICE_UNAVAILABLE', {
      operation: 'notifications.inbox-sync',
      message: 'Bildirimler şu anda eşitlenemiyor.',
      cause: pending.error,
    })
  }

  const port = createDashboardInboxPort()
  let consumed = 0
  let failed = 0
  for (const eventId of pending.value) {
    const result = await consumeDashboardInbox(eventId, port)
    if (result.ok) consumed += result.value.duplicate ? 0 : 1
    else {
      failed += 1
      console.error('[dashboard-inbox-sync]', { restaurantId, eventId, error: result.error })
    }
  }

  const unread = await countUnreadInboxNotifications({ restaurantId, userId: user.id })
  if (!unread.ok) {
    return dashboardActionFailure('SERVICE_UNAVAILABLE', {
      operation: 'notifications.inbox-sync-count',
      message: 'Bildirim sayacı yüklenemedi.',
      cause: unread.error,
    })
  }
  return { unread: unread.value, consumed, failed }
}

// ── Per-user e-mail channel opt-in (notification_preferences) ───────────────
// Mutable categories only: billing/system e-mails are unmutable by design and
// never surface as a preference. The merge is server-side so other channels'
// stored prefs are preserved.

export interface EmailNotificationPrefs {
  order: boolean
  service_request: boolean
}

export async function getMyEmailNotificationPrefs(
  restaurantId: string,
): Promise<EmailNotificationPrefs | DashboardActionFailure> {
  const { user } = await getAuthUser()
  if (!user) return dashboardAccessFailure('Not authenticated', 'notifications.email-prefs')

  const gate = await assertMember(restaurantId)
  if ('error' in gate) return dashboardAccessFailure(gate.error, 'notifications.email-prefs')

  const [{ getNotificationPreferences }, { readNotificationChannelPrefs }] = await Promise.all([
    import('@garsonless/db/server'),
    import('@garsonless/domain/notifications'),
  ])
  const stored = await getNotificationPreferences({ restaurantId, userId: user.id })
  if (!stored.ok) {
    return dashboardActionFailure('SERVICE_UNAVAILABLE', {
      operation: 'notifications.email-prefs',
      message: 'E-posta tercihleri yüklenemedi.',
      cause: stored.error,
    })
  }
  const prefs = readNotificationChannelPrefs(stored.value, 'email')
  return { order: prefs.order, service_request: prefs.service_request }
}

export async function saveMyEmailNotificationPrefs(
  restaurantId: string,
  input: EmailNotificationPrefs,
): Promise<{ ok: true } | DashboardActionFailure> {
  const { user } = await getAuthUser()
  if (!user) return dashboardAccessFailure('Not authenticated', 'notifications.email-prefs-save')

  const gate = await assertMember(restaurantId)
  if ('error' in gate) return dashboardAccessFailure(gate.error, 'notifications.email-prefs-save')

  const { getNotificationPreferences, upsertNotificationPreferences } = await import('@garsonless/db/server')
  const stored = await getNotificationPreferences({ restaurantId, userId: user.id })
  if (!stored.ok) {
    return dashboardActionFailure('SERVICE_UNAVAILABLE', {
      operation: 'notifications.email-prefs-save',
      message: 'E-posta tercihleri kaydedilemedi.',
      cause: stored.error,
    })
  }
  const existing = stored.value && typeof stored.value === 'object' && !Array.isArray(stored.value)
    ? stored.value as Record<string, unknown>
    : {}
  const existingEmail = existing['email'] && typeof existing['email'] === 'object' && !Array.isArray(existing['email'])
    ? existing['email'] as Record<string, unknown>
    : {}
  const saved = await upsertNotificationPreferences({
    restaurantId,
    userId: user.id,
    prefs: {
      ...existing,
      email: {
        ...existingEmail,
        order: input.order === true,
        service_request: input.service_request === true,
      },
    },
  })
  if (!saved.ok) {
    return dashboardActionFailure('SERVICE_UNAVAILABLE', {
      operation: 'notifications.email-prefs-save',
      message: 'E-posta tercihleri kaydedilemedi.',
      cause: saved.error,
    })
  }
  return { ok: true }
}

export async function markInboxRead(
  restaurantId: string,
  ids?: string[],
): Promise<{ ok: true } | DashboardActionFailure> {
  const { user } = await getAuthUser()
  if (!user) return dashboardAccessFailure('Not authenticated', 'notifications.inbox-read')

  const gate = await assertMember(restaurantId)
  if ('error' in gate) return dashboardAccessFailure(gate.error, 'notifications.inbox-read')

  const { markInboxNotificationsRead } = await import('@garsonless/db/server')
  const marked = await markInboxNotificationsRead({ restaurantId, userId: user.id, ids })
  if (!marked.ok) {
    return dashboardActionFailure('SERVICE_UNAVAILABLE', {
      operation: 'notifications.inbox-read',
      message: 'Bildirimler okundu olarak işaretlenemedi.',
      cause: marked.error,
    })
  }
  return { ok: true }
}
