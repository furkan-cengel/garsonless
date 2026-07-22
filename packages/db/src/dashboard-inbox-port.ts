import type {
  DashboardInboxEvent,
  DashboardInboxPort,
} from '@garsonless/application/notifications'
import {
  DASHBOARD_INBOX_CONSUMER,
  DASHBOARD_INBOX_EVENT_TYPES,
  isDashboardInboxEventType,
} from '@garsonless/application/notifications'
import { err, ok } from '@garsonless/domain'
import { createServiceClient } from './client'

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function hasSection(permissions: unknown, section: 'orders' | 'tables') {
  return Array.isArray(permissions) && permissions.includes(section)
}

export function createDashboardInboxPort(): DashboardInboxPort {
  return {
    async loadEvent(eventId) {
      const service = createServiceClient()
      const { data: row, error } = await service
        .from('domain_outbox')
        .select('id, restaurant_id, event_type, aggregate_id, payload')
        .eq('id', eventId)
        .maybeSingle()
      if (error) return err(error.message)
      if (!row || !isDashboardInboxEventType(row.event_type)) return ok(null)

      const payload = object(row.payload)
      const tableId = typeof payload['tableId'] === 'string' ? payload['tableId'] : null
      let tableLabel: string | null = null
      if (tableId) {
        const { data: table, error: tableError } = await service
          .from('tables')
          .select('label')
          .eq('restaurant_id', row.restaurant_id)
          .eq('id', tableId)
          .is('deleted_at', null)
          .maybeSingle()
        if (tableError) return err(tableError.message)
        tableLabel = table?.label ?? null
      }

      return ok<DashboardInboxEvent>({
        id: row.id,
        type: row.event_type,
        restaurantId: row.restaurant_id,
        aggregateId: row.aggregate_id,
        tableLabel,
        payload,
      })
    },

    async hasReceipt(eventId) {
      const { data, error } = await createServiceClient()
        .from('domain_outbox_receipts')
        .select('outbox_id')
        .eq('outbox_id', eventId)
        .eq('consumer', DASHBOARD_INBOX_CONSUMER)
        .maybeSingle()
      return error ? err(error.message) : ok(Boolean(data))
    },

    async listRecipients(input) {
      const service = createServiceClient()
      const [restaurantResult, memberResult, prefsResult] = await Promise.all([
        service.from('restaurants').select('owner_id').eq('id', input.restaurantId).maybeSingle(),
        service
          .from('restaurant_members')
          .select('user_id, permissions')
          .eq('restaurant_id', input.restaurantId)
          .eq('status', 'active'),
        service
          .from('notification_preferences')
          .select('user_id, prefs')
          .eq('restaurant_id', input.restaurantId),
      ])
      const queryError = restaurantResult.error ?? memberResult.error ?? prefsResult.error
      if (queryError) return err(queryError.message)
      if (!restaurantResult.data) return err('Dashboard inbox restaurant not found')

      const eligibleUsers = new Set<string>([restaurantResult.data.owner_id])
      for (const member of memberResult.data ?? []) {
        if (member.user_id && hasSection(member.permissions, input.section)) eligibleUsers.add(member.user_id)
      }

      const prefsByUser = new Map<string, unknown>()
      for (const row of prefsResult.data ?? []) prefsByUser.set(row.user_id, row.prefs)

      return ok([...eligibleUsers].map((userId) => ({
        userId,
        prefs: prefsByUser.get(userId) ?? null,
      })))
    },

    async insertEntries(entries) {
      const { error } = await createServiceClient()
        .from('notification_inbox')
        .upsert(entries.map((entry) => ({
          restaurant_id: entry.restaurantId,
          recipient_user_id: entry.recipientUserId,
          outbox_id: entry.outboxId,
          category: entry.category,
          severity: entry.severity,
          title: entry.title,
          body: entry.body,
          link_path: entry.linkPath,
          dedupe_key: entry.dedupeKey,
        })), { onConflict: 'recipient_user_id,dedupe_key', ignoreDuplicates: true })
      return error ? err(error.message) : ok(null)
    },

    async recordReceipt(eventId) {
      const { error } = await createServiceClient()
        .from('domain_outbox_receipts')
        .upsert(
          { outbox_id: eventId, consumer: DASHBOARD_INBOX_CONSUMER },
          { onConflict: 'outbox_id,consumer', ignoreDuplicates: true },
        )
      return error ? err(error.message) : ok(null)
    },
  }
}

// ── Dashboard read/mark surface (service-role, explicitly user-scoped) ──────
// The server action resolves the authenticated user and passes userId here;
// RLS own-user select is defense in depth, not the primary gate.

export type InboxFeedItem = {
  id: string
  category: string
  severity: string
  title: string
  body: string
  linkPath: string | null
  readAt: string | null
  createdAt: string
}

export async function listInboxNotifications(input: {
  restaurantId: string
  userId: string
  limit?: number
}) {
  const { data, error } = await createServiceClient()
    .from('notification_inbox')
    .select('id, category, severity, title, body, link_path, read_at, created_at')
    .eq('restaurant_id', input.restaurantId)
    .eq('recipient_user_id', input.userId)
    .order('created_at', { ascending: false })
    .limit(input.limit ?? 30)
  if (error) return err(error.message)
  return ok((data ?? []).map((row): InboxFeedItem => ({
    id: row.id,
    category: row.category,
    severity: row.severity,
    title: row.title,
    body: row.body,
    linkPath: row.link_path,
    readAt: row.read_at,
    createdAt: row.created_at,
  })))
}

export async function countUnreadInboxNotifications(input: {
  restaurantId: string
  userId: string
  /** Restrict the count to specific categories (e.g. unmutable billing/system). */
  categories?: string[]
}) {
  let query = createServiceClient()
    .from('notification_inbox')
    .select('id', { count: 'exact', head: true })
    .eq('restaurant_id', input.restaurantId)
    .eq('recipient_user_id', input.userId)
    .is('read_at', null)
  if (input.categories && input.categories.length > 0) query = query.in('category', input.categories)
  const { count, error } = await query
  return error ? err(error.message) : ok(count ?? 0)
}

/**
 * Bounded self-healing query for one aggregate observed live by the dashboard.
 * The Edge worker remains the primary dispatcher; this returns only supported
 * events for that aggregate that do not yet have a dashboard-inbox receipt,
 * including an event already acknowledged while the optional endpoint was
 * unavailable.
 */
export async function listPendingDashboardInboxEventIds(input: {
  restaurantId: string
  aggregateId: string
  limit?: number
}) {
  const limit = Math.min(50, Math.max(1, input.limit ?? 25))
  const { data: events, error: eventError } = await createServiceClient()
    .from('domain_outbox')
    .select('id')
    .eq('restaurant_id', input.restaurantId)
    .eq('aggregate_id', input.aggregateId)
    .in('event_type', [...DASHBOARD_INBOX_EVENT_TYPES])
    .order('occurred_at', { ascending: false })
    .limit(limit)
  if (eventError) return err(eventError.message)

  const eventIds = (events ?? []).map((event) => event.id)
  if (eventIds.length === 0) return ok<string[]>([])

  const { data: receipts, error: receiptError } = await createServiceClient()
    .from('domain_outbox_receipts')
    .select('outbox_id')
    .eq('consumer', DASHBOARD_INBOX_CONSUMER)
    .in('outbox_id', eventIds)
  if (receiptError) return err(receiptError.message)

  const received = new Set((receipts ?? []).map((receipt) => receipt.outbox_id))
  return ok(eventIds.filter((eventId) => !received.has(eventId)))
}

export async function markInboxNotificationsRead(input: {
  restaurantId: string
  userId: string
  /** Specific entry ids, or omit to mark every unread entry read. */
  ids?: string[]
}) {
  let query = createServiceClient()
    .from('notification_inbox')
    .update({ read_at: new Date().toISOString() })
    .eq('restaurant_id', input.restaurantId)
    .eq('recipient_user_id', input.userId)
    .is('read_at', null)
  if (input.ids && input.ids.length > 0) query = query.in('id', input.ids)
  const { error } = await query
  return error ? err(error.message) : ok(null)
}
