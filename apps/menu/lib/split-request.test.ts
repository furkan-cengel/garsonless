import assert from 'node:assert/strict'
import test from 'node:test'

import {
  MAX_SPLIT_ASSIGNED_ITEMS,
  MAX_SPLIT_BODY_BYTES,
  createSplitRateLimitKey,
  createSplitRequestFingerprint,
  isValidCheckoutIdentityNumber,
  parseSplitRequestBody,
  readBoundedPaymentJson,
  splitCreateSchema,
  splitErrorStatus,
  splitPaySchema,
  validateSplitRequestHeaders,
} from './split-request.ts'

const ids = {
  tableToken: '11111111-1111-4111-8111-111111111111',
  tableSessionId: '22222222-2222-4222-8222-222222222222',
  requestId: '33333333-3333-4333-8333-333333333333',
  orderId: '44444444-4444-4444-8444-444444444444',
}

test('payment requests require JSON and enforce declared plus streamed byte limits', async () => {
  assert.equal(validateSplitRequestHeaders(new Headers())?.status, 415)
  assert.equal(validateSplitRequestHeaders(new Headers({
    'content-type': 'application/json',
    'content-length': String(MAX_SPLIT_BODY_BYTES + 1),
  }))?.status, 413)
  assert.equal(parseSplitRequestBody(' '.repeat(MAX_SPLIT_BODY_BYTES + 1)).ok, false)
  assert.equal(parseSplitRequestBody('{').ok, false)
  assert.equal(parseSplitRequestBody('{}').ok, true)

  const streamed = await readBoundedPaymentJson(new Request('https://menu.example/api/payment', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: ' '.repeat(MAX_SPLIT_BODY_BYTES + 1),
  }))
  assert.equal(streamed.ok, false)
  assert.equal(streamed.ok ? null : streamed.status, 413)

  const valid = await readBoundedPaymentJson(new Request('https://menu.example/api/payment', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{"ok":true}',
  }))
  assert.deepEqual(valid, { ok: true, data: { ok: true } })
})

test('split create requires an idempotency key and caps nested item references', () => {
  const base = {
    slug: 'test-cafe',
    tableToken: ids.tableToken,
    tableSessionId: ids.tableSessionId,
    requestId: ids.requestId,
    method: 'cash' as const,
    amount: 10,
  }
  assert.equal(splitCreateSchema.safeParse(base).success, true)
  assert.equal(splitCreateSchema.safeParse({ ...base, requestId: undefined }).success, false)
  assert.equal(splitCreateSchema.safeParse({
    ...base,
    assignedItems: [{ orderId: ids.orderId, itemId: 'line' }],
  }).success, false)
  assert.equal(splitCreateSchema.safeParse({
    ...base,
    amount: undefined,
    assignedItems: Array.from({ length: MAX_SPLIT_ASSIGNED_ITEMS + 1 }, () => ({
      orderId: ids.orderId,
      itemId: 'line',
    })),
  }).success, false)
})

test('split pay requires real bounded buyer identity and declaration idempotency', () => {
  const base = {
    slug: 'test-cafe',
    tableToken: ids.tableToken,
    tableSessionId: ids.tableSessionId,
    requestId: ids.requestId,
    amount: 10,
    buyerName: 'Ada',
    buyerSurname: 'Lovelace',
    buyerEmail: 'ada@example.com',
    buyerPhone: '+905551112233',
    buyerIdentityNumber: 'P1234567',
    deviceId: 'device-1',
  }
  assert.equal(splitPaySchema.safeParse(base).success, true)
  assert.equal(splitPaySchema.safeParse({ ...base, requestId: undefined }).success, false)
  assert.equal(splitPaySchema.safeParse({ ...base, method: 'iyzico' }).success, false)
  assert.equal(splitPaySchema.safeParse({ ...base, buyerIdentityNumber: '111 22' }).success, false)
  assert.equal(splitPaySchema.safeParse({ ...base, buyerIdentityNumber: '11111111111' }).success, false)
  assert.equal(splitPaySchema.safeParse({ ...base, deviceId: 'x'.repeat(129) }).success, false)
  const existingShare = {
    tableToken: ids.tableToken,
    shareId: '55555555-5555-4555-8555-555555555555',
    buyerName: base.buyerName,
    buyerSurname: base.buyerSurname,
    buyerEmail: base.buyerEmail,
    buyerPhone: base.buyerPhone,
    buyerIdentityNumber: base.buyerIdentityNumber,
    deviceId: base.deviceId,
  }
  assert.equal(splitPaySchema.safeParse(existingShare).success, true)
  assert.equal(splitPaySchema.safeParse({ ...existingShare, amount: 5 }).success, false)
  assert.equal(isValidCheckoutIdentityNumber('11111111110'), true)
  assert.equal(isValidCheckoutIdentityNumber('P1234567'), true)
})

test('split security failures map to operational HTTP statuses', () => {
  assert.equal(splitErrorStatus('Çok fazla pay denemesi. Lütfen kısa süre sonra tekrar deneyin.'), 429)
  assert.equal(splitErrorStatus('Pay güvenlik kontrolü kullanılamıyor'), 503)
  assert.equal(splitErrorStatus('Bu masa için çok fazla bekleyen pay var.'), 409)
})

test('split rate key is deterministic and does not expose request metadata', () => {
  const request = new Request('https://menu.example/api/split/create', {
    headers: { 'x-forwarded-for': '203.0.113.7', 'user-agent': 'test-agent' },
  })
  const key = createSplitRateLimitKey(request, ids.tableToken)
  assert.match(key, /^[a-f0-9]{64}$/)
  assert.equal(key, createSplitRateLimitKey(request, ids.tableToken))
  assert.equal(key.includes('203.0.113.7'), false)
})

test('split request fingerprint is stable across equivalent item ordering', () => {
  const first = createSplitRequestFingerprint({
    tableSessionId: ids.tableSessionId,
    method: 'cash',
    assignedItems: [
      { orderId: ids.orderId, itemId: 'b' },
      { orderId: ids.orderId, itemId: 'a' },
    ],
  })
  const second = createSplitRequestFingerprint({
    tableSessionId: ids.tableSessionId,
    method: 'cash',
    assignedItems: [
      { orderId: ids.orderId, itemId: 'a' },
      { orderId: ids.orderId, itemId: 'b' },
    ],
  })
  assert.equal(first, second)
  assert.notEqual(first, createSplitRequestFingerprint({
    tableSessionId: ids.tableSessionId,
    method: 'iyzico',
    assignedItems: [{ orderId: ids.orderId, itemId: 'a' }],
  }))
})
