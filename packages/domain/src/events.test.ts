import assert from 'node:assert/strict'
import test from 'node:test'
import { consumerForDomainEvent, shouldCreditLoyalty, type DomainEvent } from './events'

const base = {
  id: 'event-1',
  restaurantId: 'restaurant-1',
  aggregateId: 'aggregate-1',
  attempts: 1,
} as const

test('settled comp events are delivered to loyalty but never credit', () => {
  const event: DomainEvent = {
    ...base,
    type: 'order.settled',
    aggregateType: 'order',
    payload: { paymentMethod: 'comp', paidAt: '2026-07-16T00:00:00.000Z', total: 100 },
  }
  assert.equal(consumerForDomainEvent(event), 'loyalty-ledger')
  assert.equal(shouldCreditLoyalty(event), false)
})

test('only served and cancelled status changes have a loyalty effect', () => {
  const event = (to: string): DomainEvent => ({
    ...base,
    type: 'order.status_changed',
    aggregateType: 'order',
    payload: { from: 'ready', to },
  })
  assert.equal(shouldCreditLoyalty(event('preparing')), false)
  assert.equal(shouldCreditLoyalty(event('served')), true)
  assert.equal(shouldCreditLoyalty(event('cancelled')), true)
})

test('campaign delivery has an isolated durable consumer', () => {
  const event: DomainEvent = {
    ...base,
    type: 'campaign.delivery_requested',
    aggregateType: 'campaign',
    payload: { campaignId: 'aggregate-1', createdBy: null, segmentLabel: 'Tüm müşteriler' },
  }
  assert.equal(consumerForDomainEvent(event), 'campaign-sms')
})
