import assert from 'node:assert/strict'
import test from 'node:test'
import { createHmac } from 'node:crypto'
import { verifyIyzicoRefundResponse } from './iyzico-order-refund'

test('iyzico refund callback accepts only the exact signed operation response', () => {
  const secret = 'test-secret'
  const response = {
    status: 'success', paymentId: 'payment-1', price: '10.50', currency: 'TRY',
    conversationId: 'refund-1', refundHostReference: 'refund-host-1',
    signature: createHmac('sha256', secret).update('payment-1:10.5:TRY:refund-1').digest('hex'),
  }
  assert.deepEqual(verifyIyzicoRefundResponse(secret, {
    refundId: 'refund-1', providerPaymentId: 'payment-1', amount: 10.5,
  }, response), {
    providerPaymentId: 'payment-1', providerRefundRef: 'refund-host-1', amount: 10.5,
  })

  assert.equal(verifyIyzicoRefundResponse(secret, {
    refundId: 'refund-1', providerPaymentId: 'payment-1', amount: 10.5,
  }, { ...response, price: '11' }), null)
  assert.equal(verifyIyzicoRefundResponse(secret, {
    refundId: 'refund-1', providerPaymentId: 'payment-1', amount: 10.5,
  }, { ...response, signature: '0'.repeat(64) }), null)
})
