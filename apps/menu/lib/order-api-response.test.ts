import assert from 'node:assert/strict'
import test from 'node:test'
import { readOrderApiResponse } from './order-api-response.ts'

test('valid order JSON is preserved', async () => {
  const response = new Response(JSON.stringify({
    success: true,
    data: {
      orderId: '00000000-0000-0000-0000-000000000001',
      breakdown: { subtotal: 10, pointsDiscountAmount: 0, finalTotal: 10, pointsRedeemed: 0, clamped: false },
    },
  }), { headers: { 'content-type': 'application/json' } })
  const parsed = await readOrderApiResponse(response)
  assert.equal(parsed.success, true)
  assert.equal(parsed.data?.breakdown.finalTotal, 10)
})

test('coupon failures preserve their machine-readable code for checkout state', async () => {
  const response = new Response(JSON.stringify({
    success: false,
    code: 'COUPON_EXHAUSTED',
    error: 'Bu kuponun toplam kullanım hakkı doldu.',
  }), { status: 409, headers: { 'content-type': 'application/json' } })
  assert.deepEqual(await readOrderApiResponse(response), {
    success: false,
    code: 'COUPON_EXHAUSTED',
    error: 'Bu kuponun toplam kullanım hakkı doldu.',
  })
})

test('non-JSON gateway failures become retryable UI errors', async () => {
  const response = new Response('<html>Bad gateway</html>', { status: 502 })
  assert.deepEqual(await readOrderApiResponse(response), {
    success: false,
    error: 'Sipariş şu anda işlenemiyor. Lütfen tekrar deneyin.',
  })
})

test('malformed successful responses fail safely instead of locking loading state', async () => {
  const response = new Response('not-json', { status: 200 })
  assert.deepEqual(await readOrderApiResponse(response), {
    success: false,
    error: 'Sunucudan geçersiz bir yanıt alındı. Lütfen tekrar deneyin.',
  })
})
