import {
  consumerForDomainEvent,
  ok,
  shouldCreditLoyalty,
  type DomainEvent,
  type DurableConsumerName,
  type Result,
} from '@garsonless/domain'

export interface DomainEventConsumerPort {
  hasReceipt(input: { eventId: string; consumer: DurableConsumerName }): Promise<Result<boolean>>
  consumeLoyalty(event: DomainEvent): Promise<Result<null>>
  consumeCampaign(event: Extract<DomainEvent, { type: 'campaign.delivery_requested' }>): Promise<Result<null>>
  recordReceipt(input: { eventId: string; consumer: DurableConsumerName }): Promise<Result<null>>
}
export interface DomainEventConsumption {
  consumer: DurableConsumerName | null
  duplicate: boolean
  affected: boolean
}

/**
 * One delivery boundary for both the request fast-path and the durable worker.
 * Infrastructure owns provider/database details; this command owns routing,
 * no-op policy and receipt ordering. Side effects remain independently
 * idempotent because a crash may happen after the effect but before receipt.
 */
export async function consumeDomainEvent(
  event: DomainEvent,
  port: DomainEventConsumerPort,
): Promise<Result<DomainEventConsumption>> {
  const consumer = consumerForDomainEvent(event)
  if (!consumer) return ok({ consumer: null, duplicate: false, affected: false })

  const receipt = await port.hasReceipt({ eventId: event.id, consumer })
  if (!receipt.ok) return receipt
  if (receipt.value) return ok({ consumer, duplicate: true, affected: false })

  const affected = consumer === 'loyalty-ledger' ? shouldCreditLoyalty(event) : true
  const consumed = consumer === 'campaign-sms'
    ? await port.consumeCampaign(event as Extract<DomainEvent, { type: 'campaign.delivery_requested' }>)
    : await port.consumeLoyalty(event)
  if (!consumed.ok) return consumed

  const recorded = await port.recordReceipt({ eventId: event.id, consumer })
  if (!recorded.ok) return recorded
  return ok({ consumer, duplicate: false, affected })
}
