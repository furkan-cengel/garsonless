import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import {
  verifyAddOnCheckoutResult,
  verifyAddOnRefundReport,
} from './iyzico-add-on-provider'
function signed(fraudStatus = 1) {
  const r = {
    status: 'success',
    paymentStatus: 'SUCCESS',
    paymentId: 'payment',
    currency: 'TRY',
    basketId: 'purchase',
    conversationId: 'purchase',
    price: '468.00',
    paidPrice: '468.00',
    token: 'token',
    fraudStatus,
    signature: '',
  }
  r.signature = createHmac('sha256', 'test-secret')
    .update('SUCCESS:payment:TRY:purchase:purchase:468:468:token')
    .digest('hex')
  return r
}
test('signed provider payment preserves exact minor units', () => {
  assert.equal(
    verifyAddOnCheckoutResult(signed(), 'test-secret').totalAmountMinor,
    46800,
  )
})
test('fake signatures and changed amounts never unlock', () => {
  assert.throws(() =>
    verifyAddOnCheckoutResult({ ...signed(), paidPrice: '1' }, 'test-secret'),
  )
  assert.throws(() => verifyAddOnCheckoutResult(signed(), 'wrong-secret'))
})
test('fraud review stays pending; undocumented fraud states fail closed', () => {
  assert.equal(
    verifyAddOnCheckoutResult(signed(0), 'test-secret').status,
    'review',
  )
  assert.throws(() => verifyAddOnCheckoutResult(signed(2), 'test-secret'))
  assert.equal(
    verifyAddOnCheckoutResult(signed(-1), 'test-secret').status,
    'failed',
  )
})
test('refund reporting is bound to original payment and sums distinct successful refunds', () => {
  const e = verifyAddOnCheckoutResult(signed(), 'test-secret')
  const refund = {
    refundId: 'r1',
    currencyCode: 'TRY',
    refundStatus: 1,
    refundPrice: '468',
  }
  const p = {
    paymentId: 'payment',
    paymentConversationId: 'purchase',
    currency: 'TRY',
    paidPrice: 468,
    paymentRefundStatus: 'TOTALLY_REFUNDED',
    cancels: [refund, refund],
  }
  assert.equal(
    verifyAddOnRefundReport({ status: 'success', payments: [p] }, e),
    46800,
  )
  assert.throws(() =>
    verifyAddOnRefundReport(
      { status: 'success', payments: [{ ...p, paymentId: 'foreign' }] },
      e,
    ),
  )
  assert.throws(() =>
    verifyAddOnRefundReport(
      {
        status: 'success',
        payments: [{ ...p, cancels: [{ ...refund, refundPrice: 1 }] }],
      },
      e,
    ),
  )
})
