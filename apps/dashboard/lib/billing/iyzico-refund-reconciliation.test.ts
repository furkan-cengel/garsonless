import assert from 'node:assert/strict'
import test from 'node:test'
import { verifyIyzicoFullRefundReportingEvidence } from './iyzico-refund-reconciliation'

const input = {
  providerPaymentId: 'payment-1', amountMinor: 46_560,
  requestedAt: '2026-09-02T11:52:03.908Z',
}

test('reporting evidence accepts only the exact successful total refund after the local request', () => {
  const result = verifyIyzicoFullRefundReportingEvidence({
    status: 'success',
    payments: [{
      paymentId: 'payment-1', paymentRefundStatus: 'TOTALLY_REFUNDED',
      price: 465.6, currency: 'TRY',
      cancels: [{ refundId: 5737427, refundPrice: 465.6, refundStatus: 1,
        createdDate: '2026-09-02T11:52:04Z', currencyCode: 'TRY' }],
    }],
  }, input)
  assert.deepEqual(result, { ok: true, value: {
    providerRefundRef: 'iyzico-reporting-refund:5737427',
    providerRefundedAt: '2026-09-02T11:52:04.000Z',
    verificationNote: 'iyzico_reporting:totally_refunded',
  } })
})

test('reporting evidence rejects mismatched, partial and stale refund movements', () => {
  for (const payment of [
    { paymentId: 'foreign', paymentRefundStatus: 'TOTALLY_REFUNDED', price: 465.6, currency: 'TRY', cancels: [] },
    { paymentId: 'payment-1', paymentRefundStatus: 'PARTIALLY_REFUNDED', price: 465.6, currency: 'TRY', cancels: [] },
    { paymentId: 'payment-1', paymentRefundStatus: 'TOTALLY_REFUNDED', price: 465.6, currency: 'TRY',
      cancels: [{ refundId: 1, refundPrice: 465.6, refundStatus: 1,
        createdDate: '2026-09-01T11:52:04Z', currencyCode: 'TRY' }] },
  ]) {
    assert.equal(verifyIyzicoFullRefundReportingEvidence({ status: 'success', payments: [payment] }, input).ok, false)
  }
})

test('reporting evidence normalizes iyzico Turkey wall time carrying a Z suffix', () => {
  const result = verifyIyzicoFullRefundReportingEvidence({
    status: 'success', payments: [{
      paymentId: 'payment-1', paymentRefundStatus: 'TOTALLY_REFUNDED',
      price: 465.6, currency: 'TRY',
      cancels: [{ refundId: 5737427, refundPrice: 465.6, refundStatus: 1,
        createdDate: '2026-09-02T14:52:04Z', currencyCode: 'TRY' }],
    }],
  }, input)
  assert.equal(result.ok && result.value.providerRefundedAt, '2026-09-02T11:52:04.000Z')
})
