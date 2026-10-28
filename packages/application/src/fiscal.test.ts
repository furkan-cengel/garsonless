import assert from 'node:assert/strict'
import test from 'node:test'
import {
  allocateFiscalPayment,
  buildFiscalBasket,
  mapFiscalSections,
  parseTokenxEvent,
  parseTokenxPairingCode,
} from './fiscal'

const sections = [
  { sectionNo: 1, name: 'Yiyecek', taxPercent: 1000 },
  { sectionNo: 2, name: 'İçecek', taxPercent: 2000 },
  { sectionNo: 3, name: 'Yiyecek 2', taxPercent: 1000 },
]

test('basket lines use the device units: kuruş, VAT × 100, quantity × 1000', () => {
  const result = buildFiscalBasket([
    { id: 'o1', total: 225, lines: [
      { name: 'Pizza', price: 150, quantity: 1, vatRate: 10 },
      { name: 'Cola', price: 37.5, quantity: 2, vatRate: 20 },
    ] },
  ], sections)
  assert.deepEqual(result, { ok: true, basket: {
    items: [
      { name: 'Pizza', price: 15000, sectionNo: 1, taxPercent: 1000, quantity: 1000 },
      { name: 'Cola', price: 3750, sectionNo: 2, taxPercent: 2000, quantity: 2000 },
    ],
    discount: 0,
    total: 22500,
  } })
})

test('modifier prices are part of the unit price and a discount becomes the basket adjustment', () => {
  const result = buildFiscalBasket([
    { id: 'o1', total: 100, lines: [{ name: 'Latte', price: 90, modifiersPriceDelta: 20, quantity: 1, vatRate: 10 }] },
  ], sections)
  assert.ok(result.ok)
  assert.equal(result.basket.items[0]?.price, 11000)
  assert.equal(result.basket.discount, 1000)
  assert.equal(result.basket.total, 10000)
})

test('a bill with an unknown or unmapped VAT rate is held back', () => {
  assert.deepEqual(buildFiscalBasket([{ id: 'o', total: 10, lines: [{ name: 'X', price: 10, quantity: 1, vatRate: null }] }], sections), { ok: false, reason: 'unknown_vat', rates: [] })
  assert.deepEqual(buildFiscalBasket([{ id: 'o', total: 10, lines: [{ name: 'X', price: 10, quantity: 1, vatRate: 1 }] }], sections), { ok: false, reason: 'unmapped_vat', rates: [1] })
})

test('an owner override picks among sections with the same rate, never a wrong rate', () => {
  assert.equal(mapFiscalSections([10], sections).map.get(1000), 1)
  assert.equal(mapFiscalSections([10], sections, { '1000': 3 }).map.get(1000), 3)
  assert.deepEqual(mapFiscalSections([10], sections, { '1000': 2 }).missing, [10])
})

test('a mixed payment labels orders by what is left to cover, largest order first', () => {
  const allocation = allocateFiscalPayment(
    [{ id: 'a', total: 100 }, { id: 'b', total: 60 }, { id: 'c', total: 40 }],
    [{ type: 1, amount: 10000 }, { type: 3, amount: 10000 }],
  )
  assert.deepEqual(allocation, [
    { orderId: 'a', method: 'cash' },
    { orderId: 'b', method: 'pos' },
    { orderId: 'c', method: 'pos' },
  ])
  assert.deepEqual(allocateFiscalPayment([{ id: 'a', total: 50 }], [{ type: 3, amount: 5000 }]), [{ orderId: 'a', method: 'pos' }])
})

test('TokenX webhooks: payment, cancel, void and lock; anything else is ignored', () => {
  const completed = parseTokenxEvent({
    terminalId: 'AV0000000823', clientId: 'c', operation: 'BASKET_COMPLETED', operationDate: '2026-11-03T10:00:00Z',
    data: { basketID: 'b1', status: 0, receiptNo: 12, zNo: 3, paymentItems: [{ amount: 1000, type: 1, description: 'Nakit', operatorId: '7' }] },
  })
  assert.deepEqual(completed, {
    kind: 'completed', basketId: 'b1', terminalId: 'AV0000000823', receiptNo: '12', zNo: '3',
    payments: [{ type: 1, amount: 1000, description: 'Nakit', operatorId: '7' }],
  })
  assert.deepEqual(parseTokenxEvent({ operation: 'BASKET_COMPLETED', data: { basketID: 'b1', status: -1 } }), { kind: 'cancelled', basketId: 'b1' })
  assert.deepEqual(parseTokenxEvent({ operation: 'BASKET_COMPLETED', data: { basketID: 'b1', status: 99, receiptNo: -1 } }), { kind: 'voided', basketId: 'b1' })
  assert.deepEqual(parseTokenxEvent({ operation: 'BASKET_LOCKED', terminalId: 'T', data: { basketID: 'b1' } }), { kind: 'locked', basketId: 'b1', terminalId: 'T' })
  assert.equal(parseTokenxEvent({ operation: 'SOMETHING', data: { basketID: 'b1' } }), null)
  assert.equal(parseTokenxEvent({ operation: 'BASKET_COMPLETED', data: {} }), null)
})

test('the TokenX Connect QR code carries merchant, branch and terminal', () => {
  assert.deepEqual(parseTokenxPairingCode(' 1234_13e5862b-1328-47dd-887c-d9ca6cb4375c_AV0000000823 '), {
    merchantId: '1234', branchId: '13e5862b-1328-47dd-887c-d9ca6cb4375c', terminalId: 'AV0000000823',
  })
  assert.equal(parseTokenxPairingCode('only_two'), null)
  assert.equal(parseTokenxPairingCode('a_b_c<script>'), null)
})
