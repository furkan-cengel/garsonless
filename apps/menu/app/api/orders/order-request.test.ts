import assert from 'node:assert/strict'
import test from 'node:test'

import {
  MAX_ORDER_BODY_BYTES,
  parseOrderRequestBody,
  validateOrderRequestHeaders,
} from './order-request.ts'

const orderItem = {
  itemId: '11111111-1111-4111-8111-111111111111',
  quantity: 1,
}

const validBody = {
  slug: 'maf-cafe',
  tableToken: '22222222-2222-4222-8222-222222222222',
  sessionId: '33333333-3333-4333-8333-333333333333',
  requestId: '44444444-4444-4444-8444-444444444444',
  items: [orderItem],
}

test('order request requires JSON and rejects declared oversized bodies', () => {
  assert.equal(validateOrderRequestHeaders(new Headers())?.status, 415)
  const wrongType = validateOrderRequestHeaders(new Headers({ 'content-type': 'text/plain' }))
  assert.equal(wrongType?.status, 415)
  const oversized = validateOrderRequestHeaders(new Headers({
    'content-type': 'application/json',
    'content-length': String(MAX_ORDER_BODY_BYTES + 1),
  }))
  assert.equal(oversized?.status, 413)
})

test('order body accepts a bounded valid request and rejects malformed JSON', () => {
  assert.equal(parseOrderRequestBody(JSON.stringify(validBody)).ok, true)
  const malformed = parseOrderRequestBody('{')
  assert.equal(malformed.ok, false)
  if (!malformed.ok) assert.equal(malformed.status, 400)
})

test('order body carries one optional coupon code to the server pricing boundary', () => {
  const parsed = parseOrderRequestBody(JSON.stringify({ ...validBody, couponCode: '  HOSGELDIN25  ' }))
  assert.equal(parsed.ok, true)
  if (parsed.ok) assert.equal(parsed.data.couponCode, 'HOSGELDIN25')
})

test('order body accepts the closed promo-slider promotion identity', () => {
  const parsed = parseOrderRequestBody(JSON.stringify({
    ...validBody,
    items: [{
      ...orderItem,
      quantity: 2,
      promotion: { sectionInstanceId: 'slider-home', kind: 'promo-slider' },
    }],
  }))
  assert.equal(parsed.ok, true)
})

test('order body accepts a complete freebie campaign pair identity', () => {
  const instanceId = '55555555-5555-4555-8555-555555555555'
  const parsed = parseOrderRequestBody(JSON.stringify({
    ...validBody,
    items: [
      {
        ...orderItem,
        promotion: { sectionInstanceId: 'slider-home', kind: 'promo-slider', offer: 'freebie', instanceId, role: 'qualifier' },
      },
      {
        ...orderItem,
        itemId: '66666666-6666-4666-8666-666666666666',
        promotion: { sectionInstanceId: 'slider-home', kind: 'promo-slider', offer: 'freebie', instanceId, role: 'reward' },
      },
    ],
  }))
  assert.equal(parsed.ok, true)
})

test('order body caps line count, quantity, notes and actual bytes', () => {
  assert.equal(parseOrderRequestBody(JSON.stringify({ ...validBody, items: Array.from({ length: 51 }, () => orderItem) })).ok, false)
  assert.equal(parseOrderRequestBody(JSON.stringify({ ...validBody, items: [{ ...orderItem, quantity: 100 }] })).ok, false)
  assert.equal(parseOrderRequestBody(JSON.stringify({ ...validBody, items: [{ ...orderItem, productNote: 'x'.repeat(501) }] })).ok, false)
  const oversized = parseOrderRequestBody(' '.repeat(MAX_ORDER_BODY_BYTES + 1))
  assert.equal(oversized.ok, false)
  if (!oversized.ok) assert.equal(oversized.status, 413)
})
