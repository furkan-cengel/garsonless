import assert from 'node:assert/strict'
import test from 'node:test'
import { err, ok, type DomainEvent, type DurableConsumerName } from '@garsonless/domain'
import { consumeDomainEvent, type DomainEventConsumerPort } from './outbox'

const event: DomainEvent = {
  id: 'event-1',
  type: 'order.settled',
  restaurantId: 'restaurant-1',
  aggregateType: 'order',
  aggregateId: 'order-1',
  payload: { paymentMethod: 'cash', paidAt: '2026-07-16T00:00:00.000Z', total: 100 },
  attempts: 1,
}

function port(overrides: Partial<DomainEventConsumerPort> = {}): DomainEventConsumerPort {
  return {
    async hasReceipt() { return ok(false) },
    async consumeLoyalty() { return ok(null) },
    async consumeCampaign() { return ok(null) },
    async recordReceipt() { return ok(null) },
    ...overrides,
  }
}

test('consumes effect before recording its receipt', async () => {
  const calls: string[] = []
  const result = await consumeDomainEvent(event, port({
    async hasReceipt() { calls.push('check'); return ok(false) },
    async consumeLoyalty() { calls.push('effect'); return ok(null) },
    async recordReceipt() { calls.push('receipt'); return ok(null) },
  }))
  assert.deepEqual(calls, ['check', 'effect', 'receipt'])
  assert.deepEqual(result, { ok: true, value: { consumer: 'loyalty-ledger', duplicate: false, affected: true } })
})
test('receipt makes duplicate delivery a no-op', async () => {
  let effects = 0
  const result = await consumeDomainEvent(event, port({
    async hasReceipt() { return ok(true) },
    async consumeLoyalty() { effects += 1; return ok(null) },
  }))
  assert.equal(effects, 0)
  assert.deepEqual(result, { ok: true, value: { consumer: 'loyalty-ledger', duplicate: true, affected: false } })
})

test('does not record a receipt when the effect fails', async () => {
  let receipts = 0
  const result = await consumeDomainEvent(event, port({
    async consumeLoyalty() { return err('ledger unavailable') },
    async recordReceipt(_input: { eventId: string; consumer: DurableConsumerName }) { receipts += 1; return ok(null) },
  }))
  assert.deepEqual(result, { ok: false, error: 'ledger unavailable' })
  assert.equal(receipts, 0)
})
