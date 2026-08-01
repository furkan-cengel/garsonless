import Iyzipay from 'iyzipay'
import { createHmac, timingSafeEqual } from 'node:crypto'

export interface IyzicoOrderRefundConfig {
  apiKey: string
  secretKey: string
  baseUrl: string
}

export interface VerifiedIyzicoRefund {
  providerPaymentId: string
  providerRefundRef: string
  amount: number
}

interface IyzicoRefundResponse {
  status?: string
  errorCode?: string
  errorMessage?: string
  conversationId?: string
  paymentId?: string
  price?: string | number
  currency?: string
  refundHostReference?: string
  signature?: string
}

export class IyzicoRefundRejectedError extends Error {
  constructor(readonly code: string, message: string) {
    super(message)
    this.name = 'IyzicoRefundRejectedError'
  }
}

export class IyzicoRefundUncertainError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'IyzicoRefundUncertainError'
  }
}

function decimal(value: string | number | undefined): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const raw = String(value).trim()
  if (!/^\d+(?:\.\d+)?$/.test(raw)) return null
  const normalized = raw.includes('.') ? raw.replace(/0+$/, '').replace(/\.$/, '') : raw
  return normalized.replace(/^0+(?=\d)/, '') || '0'
}

function signed(secretKey: string, parts: readonly string[], supplied: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(supplied)) return false
  const expected = createHmac('sha256', secretKey).update(parts.join(':'), 'utf8').digest('hex')
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(supplied, 'hex'))
}

export function verifyIyzicoRefundResponse(
  secretKey: string,
  input: { refundId: string; providerPaymentId: string; amount: number },
  result: IyzicoRefundResponse,
): VerifiedIyzicoRefund | null {
  const price = decimal(result.price)
  const expectedPrice = decimal(input.amount.toFixed(2))
  const paymentId = result.paymentId?.trim() ?? ''
  const conversationId = result.conversationId?.trim() ?? ''
  const currency = result.currency?.trim() ?? ''
  const refundRef = result.refundHostReference?.trim() ?? ''
  const signature = result.signature?.trim().toLowerCase() ?? ''
  if (result.status !== 'success' || !price || price !== expectedPrice
      || paymentId !== input.providerPaymentId || conversationId !== input.refundId
      || currency !== 'TRY' || !refundRef
      || !signed(secretKey, [paymentId, price, currency, conversationId], signature)) return null
  return { providerPaymentId: paymentId, providerRefundRef: refundRef, amount: Number(price) }
}

/** Calls iyzico Refund V2. The caller must reserve the local intent first so a
 * network-uncertain response can never be retried into a double refund. */
export function requestVerifiedIyzicoRefund(
  config: IyzicoOrderRefundConfig,
  input: { refundId: string; providerPaymentId: string; amount: number },
): Promise<VerifiedIyzicoRefund> {
  const client = new Iyzipay({ apiKey: config.apiKey, secretKey: config.secretKey, uri: config.baseUrl })
  const requestedPrice = input.amount.toFixed(2)

  return new Promise((resolve, reject) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      reject(new IyzicoRefundUncertainError('İyzico iade yanıtı zaman aşımına uğradı; sağlayıcıdan teyit edilmeden tekrar denenemez'))
    }, 15_000)

    client.refundV2.create({
      locale: 'tr',
      conversationId: input.refundId,
      paymentId: input.providerPaymentId,
      price: requestedPrice,
      currency: 'TRY',
    }, (error, result) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (error) {
        reject(new IyzicoRefundUncertainError('İyzico iade sonucuna ulaşılamadı; sağlayıcıdan teyit edilmeden tekrar denenemez'))
        return
      }
      if (result.status !== 'success') {
        reject(new IyzicoRefundRejectedError(
          result.errorCode?.slice(0, 80) || 'provider_rejected',
          'İyzico iade talebini reddetti',
        ))
        return
      }

      const verified = verifyIyzicoRefundResponse(config.secretKey, input, result)
      if (!verified) {
        reject(new IyzicoRefundUncertainError('İyzico iade cevabının imzası veya alanları doğrulanamadı; uzlaştırma gerekli'))
        return
      }
      resolve(verified)
    })
  })
}
