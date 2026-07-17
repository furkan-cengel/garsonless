import { consumeDomainEvent, type DomainEventConsumerPort } from '@garsonless/application/outbox'
import {
  err,
  ok,
  type DomainEvent,
  type DomainEventType,
  type DurableConsumerName,
  type PaymentMethod,
  type Result,
} from '@garsonless/domain'
import { deliverCampaign } from './campaigns'
import { createServiceClient } from './client'
import {
  creditVisitsForSessionStrict,
  creditWelcomeBonusStrict,
  earnForOrderStrict,
  refundCancelledLoyaltyOrderStrict,
} from './loyalty'

type OutboxRow = {
  id: string
  restaurant_id: string
  aggregate_type: string
  aggregate_id: string
  event_type: string
  payload: unknown
  attempts: number
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function nullableText(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function paymentMethod(value: unknown): PaymentMethod | null | undefined {
  if (value === null) return null
  return ['iyzico', 'cash', 'pos', 'comp', 'split'].includes(String(value)) ? (value as PaymentMethod) : undefined
}

function aggregateMatches(row: OutboxRow, expected: string): boolean {
  return row.aggregate_type === expected
}

function toDomainEvent(row: OutboxRow): Result<DomainEvent> {
  const payload = object(row.payload)
  const base = {
    id: row.id,
    restaurantId: row.restaurant_id,
    aggregateId: row.aggregate_id,
    attempts: row.attempts,
  }
  switch (row.event_type) {
    case 'order.created': {
      if (!aggregateMatches(row, 'order')) return err('Order event aggregate mismatch')
      return ok({
        ...base,
        type: row.event_type,
        aggregateType: 'order',
        payload,
      })
    }
    case 'order.status_changed': {
      if (!aggregateMatches(row, 'order')) return err('Order event aggregate mismatch')
      return ok({
        ...base,
        type: row.event_type,
        aggregateType: 'order',
        payload: { from: text(payload['from']), to: text(payload['to']) },
      })
    }
    case 'order.settled': {
      if (!aggregateMatches(row, 'order')) return err('Order event aggregate mismatch')
      const method = paymentMethod(payload['paymentMethod'])
      if (method === undefined) return err('Order event payment method is invalid')
      return ok({
        ...base,
        type: row.event_type,
        aggregateType: 'order',
        payload: {
          paymentMethod: method,
          paidAt: text(payload['paidAt']),
          total: Number(payload['total'] ?? 0),
        },
      })
    }
    case 'table_session.closed': {
      if (!aggregateMatches(row, 'table_session')) return err('Table session event aggregate mismatch')
      return ok({
        ...base,
        type: row.event_type,
        aggregateType: 'table_session',
        payload: {
          tableId: text(payload['tableId']),
          closedAt: text(payload['closedAt']),
          closeReason: nullableText(payload['closeReason']),
        },
      })
    }
    case 'service_request.created': {
      if (!aggregateMatches(row, 'service_request')) return err('Service request event aggregate mismatch')
      return ok({
        ...base,
        type: row.event_type,
        aggregateType: 'service_request',
        payload,
      })
    }
    case 'customer.welcome_bonus_requested': {
      if (!aggregateMatches(row, 'customer')) return err('Customer event aggregate mismatch')
      const customerId = text(payload['customerId'])
      if (!customerId) return err('Welcome bonus event is missing customerId')
      return ok({
        ...base,
        type: row.event_type,
        aggregateType: 'customer',
        payload: { customerId },
      })
    }
    case 'campaign.delivery_requested': {
      if (!aggregateMatches(row, 'campaign')) return err('Campaign event aggregate mismatch')
      const campaignId = text(payload['campaignId'])
      if (!campaignId || campaignId !== row.aggregate_id) return err('Campaign event aggregate mismatch')
      return ok({
        ...base,
        type: row.event_type,
        aggregateType: 'campaign',
        payload: {
          campaignId,
          createdBy: nullableText(payload['createdBy']),
          segmentLabel: text(payload['segmentLabel'], 'Kampanya'),
        },
      })
    }
    default:
      return err(`Unsupported domain event: ${row.event_type}`)
  }
}

export function createDomainEventConsumerPort(): DomainEventConsumerPort {
  return {
    async hasReceipt(input) {
      const { data, error } = await createServiceClient()
        .from('domain_outbox_receipts')
        .select('outbox_id')
        .eq('outbox_id', input.eventId)
        .eq('consumer', input.consumer)
        .maybeSingle()
      return error ? err(error.message) : ok(Boolean(data))
    },
    async consumeLoyalty(event) {
      try {
        if (event.type === 'order.settled') {
          if (event.payload.paymentMethod !== 'comp') await earnForOrderStrict(event.aggregateId, 'paid')
          return ok(null)
        }
        if (event.type === 'order.status_changed') {
          if (event.payload.to === 'served') await earnForOrderStrict(event.aggregateId, 'served')
          if (event.payload.to === 'cancelled') await refundCancelledLoyaltyOrderStrict(event.aggregateId)
          return ok(null)
        }
        if (event.type === 'table_session.closed') {
          if (event.payload.closeReason == null) await creditVisitsForSessionStrict(event.aggregateId)
          return ok(null)
        }
        if (event.type === 'customer.welcome_bonus_requested') {
          await creditWelcomeBonusStrict(event.payload.customerId, event.restaurantId)
        }
        return ok(null)
      } catch (cause) {
        return err(cause instanceof Error ? cause.message : 'Loyalty event failed')
      }
    },
    async consumeCampaign(event) {
      try {
        await deliverCampaign({
          restaurantId: event.restaurantId,
          campaignId: event.payload.campaignId,
          createdBy: event.payload.createdBy,
          segmentLabel: event.payload.segmentLabel,
        })
        return ok(null)
      } catch (cause) {
        return err(cause instanceof Error ? cause.message : 'Campaign delivery failed')
      }
    },
    async recordReceipt(input) {
      const { error } = await createServiceClient()
        .from('domain_outbox_receipts')
        .upsert(
          { outbox_id: input.eventId, consumer: input.consumer },
          { onConflict: 'outbox_id,consumer', ignoreDuplicates: true },
        )
      return error ? err(error.message) : ok(null)
    },
  }
}

export async function processDomainOutboxEvent(eventId: string) {
  const { data, error } = await createServiceClient()
    .from('domain_outbox')
    .select('id, restaurant_id, aggregate_type, aggregate_id, event_type, payload, attempts')
    .eq('id', eventId)
    .maybeSingle()
  if (error) return err(error.message)
  if (!data) return err('Domain event not found')
  const event = toDomainEvent(data as OutboxRow)
  return event.ok ? consumeDomainEvent(event.value, createDomainEventConsumerPort()) : event
}

export async function dispatchAggregateDomainEvents(input: {
  aggregateId: string
  eventTypes: DomainEventType[]
}): Promise<void> {
  const { data, error } = await createServiceClient()
    .from('domain_outbox')
    .select('id')
    .eq('aggregate_id', input.aggregateId)
    .in('event_type', input.eventTypes)
    .is('processed_at', null)
    .order('occurred_at', { ascending: true })
  if (error) {
    console.error(`[dispatchAggregateDomainEvents] aggregate=${input.aggregateId}: ${error.message}`)
    return
  }
  for (const row of (data ?? []) as Array<{ id: string }>) {
    const result = await processDomainOutboxEvent(row.id)
    if (!result.ok) console.error(`[processDomainOutboxEvent] event=${row.id}: ${result.error}`)
  }
}

export async function requestWelcomeBonus(input: { customerId: string; restaurantId: string }): Promise<void> {
  const service = createServiceClient()
  const { error } = await service.rpc('enqueue_domain_outbox_event', {
    p_restaurant_id: input.restaurantId,
    p_aggregate_type: 'customer',
    p_aggregate_id: input.customerId,
    p_event_type: 'customer.welcome_bonus_requested',
    p_payload: { customerId: input.customerId },
    p_idempotency_key: `customer.welcome_bonus_requested:${input.restaurantId}:${input.customerId}`,
  })
  if (error) {
    console.error(`[requestWelcomeBonus] customer=${input.customerId}: ${error.message}`)
    return
  }
  await dispatchAggregateDomainEvents({
    aggregateId: input.customerId,
    eventTypes: ['customer.welcome_bonus_requested'],
  })
}

export function isDurableConsumerEventType(value: string): value is DomainEventType {
  return [
    'order.status_changed',
    'order.settled',
    'table_session.closed',
    'customer.welcome_bonus_requested',
    'campaign.delivery_requested',
  ].includes(value)
}

export type { DurableConsumerName }
