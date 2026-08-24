import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import test from 'node:test'
import { classifyIyzicoSplitCheckoutResult } from './iyzico-split-reconciliation'

const secret = 'secret'
const shareId = 'share-id'
const token = 'provider-token'

function signed(input: Record<string, string | number>) {
  const parts = [
    String(input['paymentStatus'] ?? ''), String(input['paymentId'] ?? ''),
    String(input['currency'] ?? ''), String(input['basketId'] ?? ''),
    String(input['conversationId'] ?? ''), String(input['paidPrice'] ?? ''),
    String(input['price'] ?? ''), String(input['token'] ?? ''),
  ]
  return { ...input, signature: createHmac('sha256', secret).update(parts.join(':')).digest('hex') }
}

test('split reconciliation accepts only signed, mapped and amount-matched success', () => {
  const result = signed({
    status: 'success', paymentStatus: 'SUCCESS', paymentId: 'payment', currency: 'TRY',
    basketId: shareId, conversationId: shareId, paidPrice: '154.16', price: '154.16', token,
  })
  assert.deepEqual(
    classifyIyzicoSplitCheckoutResult(result, secret, { shareId, token, amount: 154.16 }),
    { outcome: 'paid', providerPaymentId: 'payment' },
  )
  assert.deepEqual(
    classifyIyzicoSplitCheckoutResult({ ...result, paidPrice: '1.00' }, secret, { shareId, token, amount: 154.16 }),
    { outcome: 'unknown', reason: 'unsigned_response' },
  )
})

test('split reconciliation accepts only a signed provider failure as definitive', () => {
  const result = signed({
    status: 'success', paymentStatus: 'FAILURE', paymentId: '', currency: '', basketId: '',
    conversationId: shareId, paidPrice: '', price: '', token,
  })
  assert.deepEqual(
    classifyIyzicoSplitCheckoutResult(result, secret, { shareId, token, amount: 154.16 }),
    { outcome: 'failed' },
  )
})
