import Iyzipay from 'iyzipay'
import { createHmac, timingSafeEqual } from 'node:crypto'

export interface IyzicoClientConfig {
  apiKey: string
  secretKey: string
  baseUrl: string
}

export function createIyzicoClient(config: IyzicoClientConfig) {
  if (!config.apiKey || !config.secretKey) {
    throw new Error('İyzico credentials not configured')
  }
  return new Iyzipay({ apiKey: config.apiKey, secretKey: config.secretKey, uri: config.baseUrl })
}

export interface CheckoutInitResult {
  paymentPageUrl: string
  token: string
}

export function initializeCheckout(
  client: Iyzipay,
  request: Parameters<Iyzipay['checkoutFormInitialize']['create']>[0],
): Promise<CheckoutInitResult> {
  return new Promise((resolve, reject) => {
    // iyzipay SDK resource method is .create (no .initialize exists)
    client.checkoutFormInitialize.create(request, (err, result) => {
      if (err) return reject(err)
      if (result.status !== 'success' || !result.paymentPageUrl || !result.token) {
        return reject(new Error(result.errorMessage ?? 'Checkout initialization failed'))
      }
      resolve({ paymentPageUrl: result.paymentPageUrl, token: result.token })
    })
  })
}

export function retrieveCheckout(
  client: Iyzipay,
  token: string,
  secretKey: string,
): Promise<{
  paymentStatus: string
  basketId: string
  paymentId: string
  paidPrice: number
  currency: string
}> {
  return new Promise((resolve, reject) => {
    // resource property is checkoutForm (from CheckoutForm.js), not checkoutFormRetrieve
    client.checkoutForm.retrieve({ token }, (err, result) => {
      if (err) return reject(err)
      if (result.status !== 'success') {
        return reject(new Error(result.errorMessage ?? 'Checkout retrieve failed'))
      }
      const price = normalizeIyzicoDecimal(result.price)
      const paidPrice = normalizeIyzicoDecimal(result.paidPrice)
      const signature = result.signature?.trim().toLowerCase() ?? ''
      const signatureParts = [
        result.paymentStatus,
        result.paymentId,
        result.currency,
        result.basketId,
        result.conversationId,
        paidPrice,
        price,
        result.token,
      ]
      if (signatureParts.some((part) => typeof part !== 'string' || part.length === 0)
          || !/^[a-f0-9]{64}$/.test(signature)
          || !verifyIyzicoResponseSignature(secretKey, signatureParts as string[], signature)) {
        return reject(new Error('Checkout retrieve signature verification failed'))
      }
      const paidPriceNumber = Number(paidPrice)
      if (!Number.isFinite(paidPriceNumber) || paidPriceNumber <= 0) {
        return reject(new Error('Checkout retrieve amount is invalid'))
      }
      resolve({
        paymentStatus: result.paymentStatus ?? '',
        basketId: result.basketId ?? '',
        paymentId: result.paymentId ?? '',
        paidPrice: paidPriceNumber,
        currency: result.currency ?? '',
      })
    })
  })
}

/** iyzico signs response fields after insignificant decimal trailing zeroes are
 * removed (for example 10.50 -> 10.5). */
export function normalizeIyzicoDecimal(value: string | number | undefined): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const raw = String(value).trim()
  if (!/^\d+(?:\.\d+)?$/.test(raw)) return null
  if (!raw.includes('.')) return raw.replace(/^0+(?=\d)/, '') || '0'
  const normalized = raw.replace(/0+$/, '').replace(/\.$/, '').replace(/^0+(?=\d)/, '')
  return normalized || '0'
}

export function verifyIyzicoResponseSignature(
  secretKey: string,
  parts: readonly string[],
  suppliedSignature: string,
): boolean {
  if (!secretKey || !/^[a-f0-9]{64}$/i.test(suppliedSignature)) return false
  const expected = createHmac('sha256', secretKey).update(parts.join(':'), 'utf8').digest('hex')
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(suppliedSignature, 'hex'))
}
