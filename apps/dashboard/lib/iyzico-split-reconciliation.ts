import Iyzipay from 'iyzipay'
import { createHmac, timingSafeEqual } from 'node:crypto'

export type SplitCheckoutReconciliation =
  | { outcome: 'paid'; providerPaymentId: string }
  | { outcome: 'failed' }
  | { outcome: 'unknown'; reason: 'provider_unavailable' | 'unsigned_response' | 'mapping_mismatch' | 'amount_mismatch' | 'pending' }

type CheckoutResult = {
  status?: string
  paymentStatus?: string
  paymentId?: string
  currency?: string
  basketId?: string
  conversationId?: string
  paidPrice?: string | number
  price?: string | number
  token?: string
  signature?: string
  errorMessage?: string
}

function normalizeDecimal(value: string | number | undefined): string {
  if (typeof value !== 'string' && typeof value !== 'number') return ''
  const raw = String(value).trim()
  if (!/^\d+(?:\.\d+)?$/.test(raw)) return ''
  if (!raw.includes('.')) return raw.replace(/^0+(?=\d)/, '') || '0'
  return raw.replace(/0+$/, '').replace(/\.$/, '').replace(/^0+(?=\d)/, '') || '0'
}

function verifySignature(secretKey: string, parts: string[], signature: string): boolean {
  if (!secretKey || !/^[a-f0-9]{64}$/i.test(signature)) return false
  const expected = createHmac('sha256', secretKey).update(parts.join(':'), 'utf8').digest('hex')
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'))
}

export function classifyIyzicoSplitCheckoutResult(
  result: CheckoutResult,
  secretKey: string,
  expected: { shareId: string; token: string; amount: number },
): SplitCheckoutReconciliation {
  if (result.status !== 'success') return { outcome: 'unknown', reason: 'provider_unavailable' }
  const paidPrice = normalizeDecimal(result.paidPrice)
  const price = normalizeDecimal(result.price)
  const parts = [
    result.paymentStatus ?? '',
    result.paymentId ?? '',
    result.currency ?? '',
    result.basketId ?? '',
    result.conversationId ?? '',
    paidPrice,
    price,
    result.token ?? '',
  ]
  if (!verifySignature(secretKey, parts, result.signature?.trim().toLowerCase() ?? '')) {
    return { outcome: 'unknown', reason: 'unsigned_response' }
  }
  if (result.token !== expected.token || result.conversationId !== expected.shareId) {
    return { outcome: 'unknown', reason: 'mapping_mismatch' }
  }
  if (result.paymentStatus === 'FAILURE') return { outcome: 'failed' }
  if (result.paymentStatus !== 'SUCCESS') return { outcome: 'unknown', reason: 'pending' }
  if (result.basketId !== expected.shareId || result.currency !== 'TRY' || !result.paymentId) {
    return { outcome: 'unknown', reason: 'mapping_mismatch' }
  }
  if (Math.round(Number(paidPrice) * 100) !== Math.round(expected.amount * 100)) {
    return { outcome: 'unknown', reason: 'amount_mismatch' }
  }
  return { outcome: 'paid', providerPaymentId: result.paymentId }
}

export function retrieveIyzicoSplitCheckout(input: {
  apiKey: string
  secretKey: string
  baseUrl: string
  shareId: string
  token: string
  amount: number
}): Promise<SplitCheckoutReconciliation> {
  const client = new Iyzipay({ apiKey: input.apiKey, secretKey: input.secretKey, uri: input.baseUrl })
  const checkoutForm = (client as unknown as {
    checkoutForm: {
      retrieve(
        request: { token: string },
        callback: (error: unknown, result: CheckoutResult) => void,
      ): void
    }
  }).checkoutForm
  return new Promise((resolve) => {
    checkoutForm.retrieve({ token: input.token }, (error, result) => {
      if (error) return resolve({ outcome: 'unknown', reason: 'provider_unavailable' })
      resolve(classifyIyzicoSplitCheckoutResult(result, input.secretKey, input))
    })
  })
}
