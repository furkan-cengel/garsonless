import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildOrderOperationalEvents,
  orderActionSuccessMessage,
  orderAdvanceLabel,
  orderPaymentLabel,
  readOrderFinancialBreakdown,
} from './order-detail-model'

test('detail presentation keeps operational status and payment meaning separate', () => {
  assert.equal(orderAdvanceLabel('preparing'), 'Hazır olarak işaretle')
  assert.equal(orderAdvanceLabel('served'), null)
  assert.equal(orderPaymentLabel({ paid_at: null, payment_method: null }), 'Henüz tahsil edilmedi')
  assert.equal(orderPaymentLabel({ paid_at: '2026-07-30T10:00:00.000Z', payment_method: 'cash' }), 'Nakit')
  assert.equal(orderActionSuccessMessage('Masa 4', 'ready'), 'Masa 4 siparişi hazır olarak işaretlendi.')
})

test('operational history uses only persisted timestamps and marks cancellation explicitly', () => {
  const events = buildOrderOperationalEvents({
    status: 'cancelled',
    created_at: '2026-07-30T10:00:00.000Z',
    sent_to_kitchen_at: '2026-07-30T10:02:00.000Z',
    ready_at: null,
    served_at: null,
    updated_at: '2026-07-30T10:05:00.000Z',
  })
  assert.deepEqual(events.map((event) => [event.id, event.at, event.current]), [
    ['created', '2026-07-30T10:00:00.000Z', false],
    ['sent_to_kitchen', '2026-07-30T10:02:00.000Z', false],
    ['ready', null, false],
    ['served', null, false],
    ['cancelled', '2026-07-30T10:05:00.000Z', true],
  ])
})

test('financial breakdown exposes supported discounts and charges without inventing values', () => {
  assert.deepEqual(readOrderFinancialBreakdown({
    subtotal: 240,
    memberDiscountAmount: 20,
    memberDiscountPct: 10,
    serviceFeeAmount: 5,
    taxAmount: 'invalid',
  }, 225), {
    subtotal: 240,
    rows: [
      { id: 'member', label: 'Üye indirimi (%10)', amount: 20, kind: 'discount' },
      { id: 'service', label: 'Servis bedeli', amount: 5, kind: 'charge' },
    ],
  })
})
