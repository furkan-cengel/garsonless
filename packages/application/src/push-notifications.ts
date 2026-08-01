import { serviceRequestLabel } from '@garsonless/domain/tables'
import { err, ok, type Result } from '@garsonless/domain'

export const DASHBOARD_PUSH_CONSUMER = 'dashboard-push'
export const DASHBOARD_PUSH_EVENT_TYPES = ['order.created', 'service_request.created'] as const
export type DashboardPushEventType = (typeof DASHBOARD_PUSH_EVENT_TYPES)[number]
export type PushRecipientSection = 'orders' | 'tables'

export type DashboardPushEvent = {
  id: string
  type: DashboardPushEventType
  restaurantId: string
  /** Resolved server-side from plan + active override. */
  featureAllowed: boolean
  settings: unknown
  tableLabel: string | null
  payload: Record<string, unknown>
  aggregateId: string
}

export type DashboardPushSubscription = {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

export type DashboardPushPayload = {
  title: string
  body: string
  icon: string
  badge: string
  tag: string
  data: { eventId: string; orderId?: string; url: string }
}

export type DashboardPushProviderResult =
  | { outcome: 'sent' }
  | { outcome: 'gone'; error: string }
  | { outcome: 'failed'; error: string }

export interface DashboardPushPort {
  loadEvent(eventId: string): Promise<Result<DashboardPushEvent | null>>
  hasReceipt(eventId: string): Promise<Result<boolean>>
  listSubscriptions(input: {
    restaurantId: string
    section: PushRecipientSection
  }): Promise<Result<DashboardPushSubscription[]>>
  readDelivery(input: {
    eventId: string
    subscriptionId: string
  }): Promise<Result<{ status: 'pending' | 'sent' | 'gone' | 'failed'; attempts: number } | null>>
  beginDelivery(input: {
    eventId: string
    subscriptionId: string
    attempts: number
  }): Promise<Result<null>>
  completeDelivery(input: {
    eventId: string
    subscriptionId: string
    status: 'sent' | 'gone' | 'failed'
    error: string | null
  }): Promise<Result<null>>
  disableSubscription(input: { subscriptionId: string; error: string }): Promise<Result<null>>
  recordReceipt(eventId: string): Promise<Result<null>>
}

export interface DashboardPushProvider {
  send(input: {
    subscription: DashboardPushSubscription
    payload: DashboardPushPayload
    topic: string
  }): Promise<DashboardPushProviderResult>
}

export type DashboardPushConsumption = {
  duplicate: boolean
  skipped: boolean
  subscriptions: number
  sent: number
  gone: number
}

export function isDashboardPushEventType(value: string): value is DashboardPushEventType {
  return (DASHBOARD_PUSH_EVENT_TYPES as readonly string[]).includes(value)
}

export function pushRecipientSection(eventType: DashboardPushEventType): PushRecipientSection {
  return eventType === 'order.created' ? 'orders' : 'tables'
}

function readBoolean(settings: unknown, key: 'newOrderPush' | 'serviceRequestPush', fallback: boolean) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return fallback
  const notifications = (settings as Record<string, unknown>)['notifications']
  if (!notifications || typeof notifications !== 'object' || Array.isArray(notifications)) return fallback
  const value = (notifications as Record<string, unknown>)[key]
  return typeof value === 'boolean' ? value : fallback
}

export function shouldDispatchDashboardPush(event: DashboardPushEvent): boolean {
  if (!event.featureAllowed) return false
  if (event.type === 'order.created' && event.payload['source'] !== 'customer') return false
  // Existing tenants already had new-order desktop notifications enabled by
  // default. The new waiter-call push channel is deliberately opt-in.
  return event.type === 'order.created'
    ? readBoolean(event.settings, 'newOrderPush', true)
    : readBoolean(event.settings, 'serviceRequestPush', false)
}

export function pushTopic(eventId: string): string {
  return eventId.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32)
}

function formatCurrency(value: unknown) {
  const amount = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(amount)) return null
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency', currency: 'TRY', maximumFractionDigits: 2,
  }).format(amount)
}

export function buildDashboardPushPayload(event: DashboardPushEvent): DashboardPushPayload {
  const tableLabel = event.tableLabel ?? 'Masa'
  if (event.type === 'order.created') {
    return {
      title: 'Yeni sipariş',
      body: [tableLabel, formatCurrency(event.payload['total'])].filter(Boolean).join(' · '),
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag: `order:${event.aggregateId}`,
      data: { eventId: event.id, orderId: event.aggregateId, url: `/dashboard/${event.restaurantId}/orders` },
    }
  }

  const requestType = typeof event.payload['requestType'] === 'string'
    ? event.payload['requestType']
    : 'waiter'
  return {
    title: 'Masa isteği',
    body: `${tableLabel} · ${serviceRequestLabel(requestType)}`,
    icon: '/icon.svg',
    badge: '/icon.svg',
    tag: `service-request:${event.id}`,
    data: { eventId: event.id, url: `/dashboard/${event.restaurantId}/tables` },
  }
}

/** Durable, retry-safe fan-out from one outbox event to eligible user devices. */
export async function consumeDashboardPush(
  eventId: string,
  port: DashboardPushPort,
  provider: DashboardPushProvider,
): Promise<Result<DashboardPushConsumption>> {
  const receipt = await port.hasReceipt(eventId)
  if (!receipt.ok) return receipt
  if (receipt.value) return ok({ duplicate: true, skipped: false, subscriptions: 0, sent: 0, gone: 0 })

  const loaded = await port.loadEvent(eventId)
  if (!loaded.ok) return loaded
  if (!loaded.value) return err('Dashboard push event not found or unsupported')
  const event = loaded.value

  if (!shouldDispatchDashboardPush(event)) {
    const recorded = await port.recordReceipt(eventId)
    return recorded.ok
      ? ok({ duplicate: false, skipped: true, subscriptions: 0, sent: 0, gone: 0 })
      : recorded
  }

  const subscriptions = await port.listSubscriptions({
    restaurantId: event.restaurantId,
    section: pushRecipientSection(event.type),
  })
  if (!subscriptions.ok) return subscriptions

  const payload = buildDashboardPushPayload(event)
  let sent = 0
  let gone = 0
  const failures: string[] = []

  for (const subscription of subscriptions.value) {
    const current = await port.readDelivery({ eventId, subscriptionId: subscription.id })
    if (!current.ok) return current
    if (current.value?.status === 'sent') { sent += 1; continue }
    if (current.value?.status === 'gone') { gone += 1; continue }

    const begun = await port.beginDelivery({
      eventId,
      subscriptionId: subscription.id,
      attempts: (current.value?.attempts ?? 0) + 1,
    })
    if (!begun.ok) return begun

    const result = await provider.send({ subscription, payload, topic: pushTopic(event.id) })
    const completed = await port.completeDelivery({
      eventId,
      subscriptionId: subscription.id,
      status: result.outcome,
      error: result.outcome === 'sent' ? null : result.error,
    })
    if (!completed.ok) return completed

    if (result.outcome === 'sent') sent += 1
    if (result.outcome === 'gone') {
      gone += 1
      const disabled = await port.disableSubscription({ subscriptionId: subscription.id, error: result.error })
      if (!disabled.ok) return disabled
    }
    if (result.outcome === 'failed') failures.push(result.error)
  }

  if (failures.length > 0) return err(`Dashboard push delivery failed: ${failures.join('; ')}`)
  const recorded = await port.recordReceipt(eventId)
  return recorded.ok
    ? ok({ duplicate: false, skipped: false, subscriptions: subscriptions.value.length, sent, gone })
    : recorded
}
