import Iyzipay from 'iyzipay'
import { request as httpsRequest } from 'node:https'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { AddOnInitializationRejected } from '@garsonless/application/add-on-purchases'
import type {
  AddOnPaymentEvidence,
  AddOnPaymentProvider,
} from '@garsonless/application/add-on-purchases'
import { addOnLabel } from '@garsonless/domain/add-on-purchases'
import { readIyzicoPaymentCredentials } from './iyzico-subscription-config'
import { billingDashboardUrl } from './subscription-billing-request'

type Response = Record<string, unknown>
function decimal(value: unknown): string {
  if (typeof value !== 'string' && typeof value !== 'number')
    throw new Error('add_on_payment_amount_invalid')
  const text = String(value)
  if (!/^\d+(?:\.\d{1,2})?$/.test(text))
    throw new Error('add_on_payment_amount_invalid')
  return text.includes('.') ? text.replace(/0+$/, '').replace(/\.$/, '') : text
}
function minor(value: unknown): number {
  const [whole, fraction = ''] = decimal(value).split('.')
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  if (!Number.isSafeInteger(amount))
    throw new Error('add_on_payment_amount_invalid')
  return amount
}
export function verifyAddOnCheckoutResult(
  result: Response,
  secretKey: string,
): AddOnPaymentEvidence {
  const fields = [
    result.paymentStatus,
    result.paymentId,
    result.currency,
    result.basketId,
    result.conversationId,
    decimal(result.paidPrice),
    decimal(result.price),
    result.token,
  ]
  if (
    result.status !== 'success' ||
    fields.some((x) => typeof x !== 'string' || x.length === 0) ||
    typeof result.signature !== 'string' ||
    !/^[a-f\d]{64}$/i.test(result.signature)
  )
    throw new Error('add_on_payment_evidence_invalid')
  const expected = createHmac('sha256', secretKey)
    .update(fields.join(':'))
    .digest()
  if (!timingSafeEqual(expected, Buffer.from(result.signature, 'hex')))
    throw new Error('add_on_payment_signature_invalid')
  if (
    !['SUCCESS', 'FAILURE'].includes(String(result.paymentStatus)) ||
    ![-1, 0, 1].includes(Number(result.fraudStatus))
  )
    throw new Error('add_on_payment_status_invalid')
  return {
    token: String(result.token),
    paymentId: String(result.paymentId),
    basketId: String(result.basketId),
    conversationId: String(result.conversationId),
    totalAmountMinor: minor(result.paidPrice),
    currency: String(result.currency),
    status:
      result.paymentStatus === 'FAILURE' || Number(result.fraudStatus) === -1
        ? 'failed'
        : Number(result.fraudStatus) === 1
          ? 'paid'
          : 'review',
    refundedAmountMinor: 0,
    chargeback: false,
  }
}
type Resource = {
  _config: { body: Record<string, unknown> }
  _preparePath(method: string): void
  _getHttpHeaders(method: string): Record<string, string>
  _getBody(method: string): Record<string, unknown>
  _getUrl(method: string): string
}
type PaymentClient = {
  checkoutFormInitialize: Resource
  checkoutForm: Resource
  reportingTransactionDetails: Resource
}
async function httpJson(
  url: string | URL,
  method: 'GET' | 'POST',
  headers: Record<string, string>,
  body?: string,
): Promise<Response> {
  const endpoint = new URL(url)
  return new Promise((resolve, reject) => {
    // Sandbox currently resets Node 24 TLS 1.3 handshakes; TLS 1.2 remains fully verified.
    const req = httpsRequest(
      endpoint,
      {
        method,
        headers,
        signal: AbortSignal.timeout(15_000),
        ...(endpoint.hostname === 'sandbox-api.iyzipay.com'
          ? { maxVersion: 'TLSv1.2' as const }
          : {}),
      },
      (response) => {
        if (response.statusCode !== 200) {
          response.resume()
          reject(new Error('add_on_provider_unavailable'))
          return
        }
        const chunks: Buffer[] = []
        let size = 0
        response.on('data', (chunk: Buffer) => {
          size += chunk.length
          if (size > 512_000)
            response.destroy(new Error('add_on_provider_response_too_large'))
          else chunks.push(chunk)
        })
        response.on('error', reject)
        response.on('end', () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
          } catch {
            reject(new Error('add_on_provider_response_invalid'))
          }
        })
      },
    )
    req.on('error', reject)
    req.end(body)
  })
}
async function request(
  resource: Resource,
  method: 'create' | 'retrieve',
  body: Record<string, unknown>,
): Promise<Response> {
  resource._config.body = body
  resource._preparePath(method)
  return httpJson(
    resource._getUrl(method),
    'POST',
    { ...resource._getHttpHeaders(method), 'Content-Type': 'application/json' },
    JSON.stringify(resource._getBody(method)),
  )
}
export async function readIyzicoAddOnPaymentReport(
  paymentId: string | null,
  conversationId: string,
): Promise<Response> {
  const config = readIyzicoPaymentCredentials()
  const client = new Iyzipay({
    apiKey: config.apiKey,
    secretKey: config.secretKey,
    uri: config.baseUrl,
  }) as unknown as PaymentClient
  const resource = client.reportingTransactionDetails
  resource._config.body = {}
  resource._preparePath('retrieve')
  const url = new URL(`${config.baseUrl}/v2/reporting/payment/details`)
  if (paymentId) url.searchParams.set('paymentId', paymentId)
  else url.searchParams.set('paymentConversationId', conversationId)
  url.searchParams.set('conversationId', conversationId)
  return httpJson(url, 'GET', resource._getHttpHeaders('retrieve'))
}
export function verifyAddOnRefundReport(
  root: Record<string, unknown>,
  evidence: AddOnPaymentEvidence,
): number {
  if (root.status !== 'success' || !Array.isArray(root.payments))
    throw new Error('add_on_refund_report_unavailable')
  const payment = root.payments.find(
    (p: Record<string, unknown>) => String(p.paymentId) === evidence.paymentId,
  ) as Record<string, unknown> | undefined
  if (
    !payment ||
    payment.currency !== 'TRY' ||
    minor(payment.paidPrice) !== evidence.totalAmountMinor ||
    payment.paymentConversationId !== evidence.conversationId
  )
    throw new Error('add_on_refund_report_mismatch')
  if (
    payment.paymentRefundStatus === 'NOT_REFUNDED' &&
    payment.paymentStatus === 1
  )
    return 0
  if (
    !['TOTALLY_REFUNDED', 'PARTIALLY_REFUNDED'].includes(
      String(payment.paymentRefundStatus),
    )
  )
    throw new Error('add_on_refund_report_status_invalid')
  if (!Array.isArray(payment.cancels))
    throw new Error('add_on_refund_report_incomplete')
  const seen = new Set<string>()
  const total = payment.cancels.reduce(
    (sum: number, r: Record<string, unknown>) => {
      if (r.refundStatus !== 1 && r.refundStatus !== 'SUCCESS') return sum
      if (!r.refundId || r.currencyCode !== 'TRY')
        throw new Error('add_on_refund_report_incomplete')
      const key = String(r.refundId)
      if (seen.has(key)) return sum
      seen.add(key)
      return sum + minor(r.refundPrice)
    },
    0,
  )
  if (
    total <= 0 ||
    total > evidence.totalAmountMinor ||
    (payment.paymentRefundStatus === 'TOTALLY_REFUNDED' &&
      total !== evidence.totalAmountMinor)
  )
    throw new Error('add_on_refund_report_amount_mismatch')
  return total
}
export function createIyzicoAddOnProvider(
  buyerIp?: string,
): AddOnPaymentProvider {
  const config = readIyzicoPaymentCredentials()
  const client = new Iyzipay({
    apiKey: config.apiKey,
    secretKey: config.secretKey,
    uri: config.baseUrl,
  }) as unknown as PaymentClient
  return {
    async initialize(purchase) {
      // Resolved per checkout so reconciliation keeps working without it. A
      // missing production origin must not send iyzico a localhost callback;
      // nothing reached the provider yet, so the purchase can fail cleanly.
      let origin: string
      try {
        origin = billingDashboardUrl('/', process.env.NEXT_PUBLIC_APP_URL).origin
      } catch {
        throw new AddOnInitializationRejected('add_on_callback_origin_unavailable')
      }
      const profile = purchase.profile
      const address = {
        contactName: profile.legalName,
        city: profile.billingAddress.city,
        country: profile.billingAddress.country ?? 'Turkey',
        address: profile.billingAddress.address,
      }
      const price = (purchase.totalAmountMinor / 100).toFixed(2)
      const result = await request(client.checkoutFormInitialize, 'create', {
        locale: 'tr',
        conversationId: purchase.id,
        basketId: purchase.id,
        price,
        paidPrice: price,
        currency: 'TRY',
        paymentGroup: 'PRODUCT',
        enabledInstallments: [1],
        callbackUrl: `${origin}/api/billing/add-ons/callback`,
        buyer: {
          id: purchase.restaurantId,
          name: profile.name,
          surname: profile.surname,
          identityNumber: profile.identityNumber,
          email: profile.email,
          gsmNumber: profile.gsmNumber,
          ip: buyerIp,
          registrationAddress: address.address,
          city: address.city,
          country: address.country,
        },
        billingAddress: address,
        basketItems: [
          {
            id: purchase.addOn,
            name: `${addOnLabel(purchase.addOn)} · Tek seferlik`,
            category1: 'Yazılım eklentisi',
            itemType: 'VIRTUAL',
            price,
          },
        ],
      })
      if (
        result.status === 'failure' &&
        typeof result.errorCode === 'string' &&
        !result.token
      )
        throw new AddOnInitializationRejected(
          `add_on_checkout_initialize_rejected:${/^\d{1,8}$/.test(result.errorCode) ? result.errorCode : '0'}`,
        )
      if (
        result.status !== 'success' ||
        typeof result.token !== 'string' ||
        typeof result.paymentPageUrl !== 'string'
      )
        throw new Error('add_on_checkout_initialize_failed')
      const url = new URL(result.paymentPageUrl)
      if (
        url.protocol !== 'https:' ||
        !['sandbox-cpp.iyzipay.com', 'cpp.iyzipay.com'].includes(url.hostname)
      )
        throw new Error('add_on_checkout_url_invalid')
      return { token: result.token, paymentPageUrl: url.href }
    },
    async verifyUnpaidInitialization(conversationId) {
      const result = await readIyzicoAddOnPaymentReport(null, conversationId)
      return (
        result.status === 'success' &&
        result.conversationId === conversationId &&
        Array.isArray(result.payments) &&
        result.payments.length === 0
      )
    },
    async retrieve(token, conversationId) {
      const result = await request(client.checkoutForm, 'retrieve', {
        token,
        conversationId,
      })
      const evidence = verifyAddOnCheckoutResult(result, config.secretKey)
      if (evidence.status === 'paid') {
        evidence.refundedAmountMinor = verifyAddOnRefundReport(
          await readIyzicoAddOnPaymentReport(
            evidence.paymentId,
            evidence.conversationId,
          ),
          evidence,
        )
      }
      return evidence
    },
  }
}
