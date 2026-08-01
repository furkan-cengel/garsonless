import type {
  DashboardPushEvent,
  DashboardPushPort,
  DashboardPushSubscription,
  PushRecipientSection,
} from '@garsonless/application/push-notifications'
import { isDashboardPushEventType, DASHBOARD_PUSH_CONSUMER } from '@garsonless/application/push-notifications'
import { err, ok } from '@garsonless/domain'
import { createServiceClient } from './client'
import { canRestaurantUseFeature } from './feature-entitlement-port'

export async function upsertDashboardPushSubscription(input: {
  restaurantId: string
  userId: string
  endpoint: string
  endpointHash: string
  p256dh: string
  auth: string
  userAgent: string | null
}) {
  const { error } = await createServiceClient()
    .from('dashboard_push_subscriptions')
    .upsert({
      restaurant_id: input.restaurantId,
      user_id: input.userId,
      endpoint: input.endpoint,
      endpoint_hash: input.endpointHash,
      p256dh: input.p256dh,
      auth: input.auth,
      user_agent: input.userAgent,
      disabled_at: null,
      failure_count: 0,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'restaurant_id,user_id,endpoint_hash' })
  return error ? err(error.message) : ok(null)
}

export async function deleteDashboardPushEndpoint(input: { userId: string; endpointHash: string }) {
  const { error } = await createServiceClient()
    .from('dashboard_push_subscriptions')
    .delete()
    .eq('user_id', input.userId)
    .eq('endpoint_hash', input.endpointHash)
  return error ? err(error.message) : ok(null)
}

export async function deleteDashboardPushSubscriptionsForUser(userId: string) {
  const { error } = await createServiceClient()
    .from('dashboard_push_subscriptions')
    .delete()
    .eq('user_id', userId)
  return error ? err(error.message) : ok(null)
}

export async function readDashboardPushSubscriptionForUser(input: { restaurantId: string; userId: string }) {
  const { data, error } = await createServiceClient()
    .from('dashboard_push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('restaurant_id', input.restaurantId)
    .eq('user_id', input.userId)
    .is('disabled_at', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return error ? err(error.message) : ok(data as DashboardPushSubscription | null)
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function hasSection(permissions: unknown, section: PushRecipientSection) {
  return Array.isArray(permissions) && permissions.includes(section)
}

export function createDashboardPushPort(): DashboardPushPort {
  return {
    async loadEvent(eventId) {
      const service = createServiceClient()
      const { data: row, error } = await service
        .from('domain_outbox')
        .select('id, restaurant_id, event_type, aggregate_id, payload')
        .eq('id', eventId)
        .maybeSingle()
      if (error) return err(error.message)
      if (!row || !isDashboardPushEventType(row.event_type)) return ok(null)

      const { data: restaurant, error: restaurantError } = await service
        .from('restaurants')
        .select('plan, settings')
        .eq('id', row.restaurant_id)
        .is('deleted_at', null)
        .maybeSingle()
      if (restaurantError) return err(restaurantError.message)
      if (!restaurant) return err('Dashboard push restaurant not found')

      const featureAllowed = await canRestaurantUseFeature({
        restaurantId: row.restaurant_id,
        plan: restaurant.plan,
        feature: 'browser_notifications',
      })

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

      return ok<DashboardPushEvent>({
        id: row.id,
        aggregateId: row.aggregate_id,
        type: row.event_type,
        restaurantId: row.restaurant_id,
        featureAllowed,
        settings: restaurant.settings,
        tableLabel,
        payload,
      })
    },

    async hasReceipt(eventId) {
      const { data, error } = await createServiceClient()
        .from('domain_outbox_receipts')
        .select('outbox_id')
        .eq('outbox_id', eventId)
        .eq('consumer', DASHBOARD_PUSH_CONSUMER)
        .maybeSingle()
      return error ? err(error.message) : ok(Boolean(data))
    },

    async listSubscriptions(input) {
      const service = createServiceClient()
      const [restaurantResult, memberResult, subscriptionResult] = await Promise.all([
        service.from('restaurants').select('owner_id').eq('id', input.restaurantId).maybeSingle(),
        service
          .from('restaurant_members')
          .select('user_id, permissions')
          .eq('restaurant_id', input.restaurantId)
          .eq('status', 'active'),
        service
          .from('dashboard_push_subscriptions')
          .select('id, user_id, endpoint, p256dh, auth')
          .eq('restaurant_id', input.restaurantId)
          .is('disabled_at', null),
      ])
      const queryError = restaurantResult.error ?? memberResult.error ?? subscriptionResult.error
      if (queryError) return err(queryError.message)
      if (!restaurantResult.data) return err('Dashboard push restaurant not found')

      const eligibleUsers = new Set<string>([restaurantResult.data.owner_id])
      for (const member of memberResult.data ?? []) {
        if (member.user_id && hasSection(member.permissions, input.section)) eligibleUsers.add(member.user_id)
      }

      const subscriptions: DashboardPushSubscription[] = (subscriptionResult.data ?? [])
        .filter((subscription) => eligibleUsers.has(subscription.user_id))
        .map((subscription) => ({
          id: subscription.id,
          endpoint: subscription.endpoint,
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        }))
      return ok(subscriptions)
    },

    async readDelivery(input) {
      const { data, error } = await createServiceClient()
        .from('dashboard_push_deliveries')
        .select('status, attempts')
        .eq('outbox_id', input.eventId)
        .eq('subscription_id', input.subscriptionId)
        .maybeSingle()
      if (error) return err(error.message)
      if (!data) return ok(null)
      if (!['pending', 'sent', 'gone', 'failed'].includes(data.status)) return err('Invalid dashboard push delivery state')
      return ok({
        status: data.status as 'pending' | 'sent' | 'gone' | 'failed',
        attempts: data.attempts,
      })
    },

    async beginDelivery(input) {
      const { error } = await createServiceClient()
        .from('dashboard_push_deliveries')
        .upsert({
          outbox_id: input.eventId,
          subscription_id: input.subscriptionId,
          status: 'pending',
          attempts: input.attempts,
          last_error: null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'outbox_id,subscription_id' })
      return error ? err(error.message) : ok(null)
    },

    async completeDelivery(input) {
      const now = new Date().toISOString()
      const service = createServiceClient()
      const { error } = await service
        .from('dashboard_push_deliveries')
        .update({
          status: input.status,
          last_error: input.error,
          sent_at: input.status === 'sent' ? now : null,
          updated_at: now,
        })
        .eq('outbox_id', input.eventId)
        .eq('subscription_id', input.subscriptionId)
      if (error) return err(error.message)

      if (input.status === 'sent') {
        const { error: subscriptionError } = await service
          .from('dashboard_push_subscriptions')
          .update({ last_success_at: now, failure_count: 0, updated_at: now })
          .eq('id', input.subscriptionId)
        if (subscriptionError) return err(subscriptionError.message)
      }
      if (input.status === 'failed') {
        const { data: subscription, error: readError } = await service
          .from('dashboard_push_subscriptions')
          .select('failure_count')
          .eq('id', input.subscriptionId)
          .maybeSingle()
        if (readError) return err(readError.message)
        const { error: subscriptionError } = await service
          .from('dashboard_push_subscriptions')
          .update({
            failure_count: (subscription?.failure_count ?? 0) + 1,
            updated_at: now,
          })
          .eq('id', input.subscriptionId)
        if (subscriptionError) return err(subscriptionError.message)
      }
      return ok(null)
    },

    async disableSubscription(input) {
      const service = createServiceClient()
      const { data, error: readError } = await service
        .from('dashboard_push_subscriptions')
        .select('failure_count')
        .eq('id', input.subscriptionId)
        .maybeSingle()
      if (readError) return err(readError.message)
      const { error } = await service
        .from('dashboard_push_subscriptions')
        .update({
          disabled_at: new Date().toISOString(),
          failure_count: (data?.failure_count ?? 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.subscriptionId)
      return error ? err(`${input.error}: ${error.message}`) : ok(null)
    },

    async recordReceipt(eventId) {
      const { error } = await createServiceClient()
        .from('domain_outbox_receipts')
        .upsert(
          { outbox_id: eventId, consumer: DASHBOARD_PUSH_CONSUMER },
          { onConflict: 'outbox_id,consumer', ignoreDuplicates: true },
        )
      return error ? err(error.message) : ok(null)
    },
  }
}
