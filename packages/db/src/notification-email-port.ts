import type {
  NotificationEmailEvent,
  NotificationEmailPort,
} from '@garsonless/application/notification-emails'
import {
  isNotificationEmailEventType,
  NOTIFICATION_EMAIL_CONSUMER,
} from '@garsonless/application/notification-emails'
import { err, ok } from '@garsonless/domain'
import type { Json } from './types.gen'
import { createServiceClient } from './service-client'

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function hasSection(permissions: unknown, section: 'orders' | 'tables') {
  return Array.isArray(permissions) && permissions.includes(section)
}

export function createNotificationEmailPort(): NotificationEmailPort {
  return {
    async loadEvent(eventId) {
      const service = createServiceClient()
      const { data: row, error } = await service
        .from('domain_outbox')
        .select('id, restaurant_id, event_type, aggregate_id, payload')
        .eq('id', eventId)
        .maybeSingle()
      if (error) return err(error.message)
      if (!row || !isNotificationEmailEventType(row.event_type)) return ok(null)

      const { data: restaurant, error: restaurantError } = await service
        .from('restaurants')
        .select('name')
        .eq('id', row.restaurant_id)
        .is('deleted_at', null)
        .maybeSingle()
      if (restaurantError) return err(restaurantError.message)
      if (!restaurant) return err('Notification email restaurant not found')

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

      return ok<NotificationEmailEvent>({
        id: row.id,
        type: row.event_type,
        restaurantId: row.restaurant_id,
        aggregateId: row.aggregate_id,
        restaurantName: restaurant.name,
        tableLabel,
        payload,
      })
    },

    async hasReceipt(eventId) {
      const { data, error } = await createServiceClient()
        .from('domain_outbox_receipts')
        .select('outbox_id')
        .eq('outbox_id', eventId)
        .eq('consumer', NOTIFICATION_EMAIL_CONSUMER)
        .maybeSingle()
      return error ? err(error.message) : ok(Boolean(data))
    },

    async listRecipients(input) {
      const service = createServiceClient()
      const [restaurantResult, memberResult, prefsResult] = await Promise.all([
        service.from('restaurants').select('owner_id').eq('id', input.restaurantId).maybeSingle(),
        service
          .from('restaurant_members')
          .select('user_id, email, permissions')
          .eq('restaurant_id', input.restaurantId)
          .eq('status', 'active'),
        service
          .from('notification_preferences')
          .select('user_id, prefs')
          .eq('restaurant_id', input.restaurantId),
      ])
      const queryError = restaurantResult.error ?? memberResult.error ?? prefsResult.error
      if (queryError) return err(queryError.message)
      if (!restaurantResult.data) return err('Notification email restaurant not found')

      const prefsByUser = new Map<string, unknown>()
      for (const row of prefsResult.data ?? []) prefsByUser.set(row.user_id, row.prefs)

      const ownerId = restaurantResult.data.owner_id
      const { data: ownerUser, error: ownerError } = await service.auth.admin.getUserById(ownerId)
      if (ownerError) return err(ownerError.message)

      const recipients = [{
        userId: ownerId,
        email: ownerUser.user?.email ?? null,
        prefs: prefsByUser.get(ownerId) ?? null,
      }]
      for (const member of memberResult.data ?? []) {
        if (!member.user_id || member.user_id === ownerId) continue
        if (!input.section || !hasSection(member.permissions, input.section)) continue
        recipients.push({
          userId: member.user_id,
          email: member.email ?? null,
          prefs: prefsByUser.get(member.user_id) ?? null,
        })
      }
      return ok(recipients)
    },

    async loadTemplate(category) {
      const { data, error } = await createServiceClient()
        .from('notification_templates')
        .select('subject, body_html')
        .eq('category', category)
        .eq('channel', 'email')
        .maybeSingle()
      if (error) return err(error.message)
      return ok(data ? { subject: data.subject, bodyHtml: data.body_html } : null)
    },

    async readDelivery(input) {
      const { data, error } = await createServiceClient()
        .from('notification_deliveries')
        .select('status, attempts')
        .eq('recipient_user_id', input.recipientUserId)
        .eq('dedupe_key', input.dedupeKey)
        .eq('channel', 'email')
        .maybeSingle()
      if (error) return err(error.message)
      if (!data) return ok(null)
      if (!['pending', 'sent', 'failed', 'dead'].includes(data.status)) {
        return err('Invalid notification delivery state')
      }
      return ok({
        status: data.status as 'pending' | 'sent' | 'failed' | 'dead',
        attempts: data.attempts,
      })
    },

    async beginDelivery(input) {
      const { error } = await createServiceClient()
        .from('notification_deliveries')
        .upsert({
          outbox_id: input.outboxId,
          restaurant_id: input.restaurantId,
          recipient_user_id: input.recipientUserId,
          channel: 'email',
          category: input.category,
          dedupe_key: input.dedupeKey,
          recipient_address: input.recipientAddress,
          subject: input.subject,
          status: 'pending',
          attempts: input.attempts,
          last_error: null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'recipient_user_id,dedupe_key,channel' })
      return error ? err(error.message) : ok(null)
    },

    async completeDelivery(input) {
      const now = new Date().toISOString()
      const { error } = await createServiceClient()
        .from('notification_deliveries')
        .update({
          status: input.status,
          provider_message_id: input.providerMessageId,
          last_error: input.error,
          sent_at: input.status === 'sent' ? now : null,
          updated_at: now,
        })
        .eq('recipient_user_id', input.recipientUserId)
        .eq('dedupe_key', input.dedupeKey)
        .eq('channel', 'email')
      return error ? err(error.message) : ok(null)
    },

    async recordReceipt(eventId) {
      const { error } = await createServiceClient()
        .from('domain_outbox_receipts')
        .upsert(
          { outbox_id: eventId, consumer: NOTIFICATION_EMAIL_CONSUMER },
          { onConflict: 'outbox_id,consumer', ignoreDuplicates: true },
        )
      return error ? err(error.message) : ok(null)
    },
  }
}

// ── Per-user preference persistence (used by the settings action) ───────────

export async function getNotificationPreferences(input: {
  restaurantId: string
  userId: string
}) {
  const { data, error } = await createServiceClient()
    .from('notification_preferences')
    .select('prefs')
    .eq('restaurant_id', input.restaurantId)
    .eq('user_id', input.userId)
    .maybeSingle()
  return error ? err(error.message) : ok(data?.prefs ?? null)
}

export async function upsertNotificationPreferences(input: {
  restaurantId: string
  userId: string
  prefs: Record<string, unknown>
}) {
  const { error } = await createServiceClient()
    .from('notification_preferences')
    .upsert({
      restaurant_id: input.restaurantId,
      user_id: input.userId,
      prefs: input.prefs as Json,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'restaurant_id,user_id' })
  return error ? err(error.message) : ok(null)
}

export async function recordResendNotificationEvent(input: {
  webhookId: string
  providerMessageId: string
  eventType: 'sent' | 'delivered' | 'delivery_delayed' | 'opened' | 'clicked' | 'bounced' | 'complained' | 'suppressed' | 'failed'
  occurredAt: string
}): Promise<boolean> {
  const occurredAt = new Date(input.occurredAt)
  if (Number.isNaN(occurredAt.getTime())) throw new Error('invalid_resend_notification_event_time')
  const service = createServiceClient()
  const rpc = service.rpc.bind(service) as unknown as (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>
  const { data, error } = await rpc('record_resend_notification_event', {
    p_webhook_id: input.webhookId,
    p_provider_message_id: input.providerMessageId,
    p_event_type: input.eventType,
    p_occurred_at: occurredAt.toISOString(),
  })
  if (error) throw new Error('record Resend notification event failed')
  return data === true
}
