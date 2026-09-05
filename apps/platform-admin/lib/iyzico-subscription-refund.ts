import Iyzipay from 'iyzipay'
import { createHmac, timingSafeEqual } from 'node:crypto'
import type {
  SubscriptionRefundProvider,
  SubscriptionRefundProviderOutcome,
} from '@garsonless/application/platform-admin-subscription-refunds'

const SANDBOX_URL = 'https://sandbox-api.iyzipay.com'
const LIVE_URL = 'https://api.iyzipay.com'
const TIMEOUT_MS = 15_000

type Response = Record<string, unknown>
type Callback = (error: Error | null, response: Response) => void
export type IyzicoRefundClient = {
  refundV2: { create(request: Record<string, unknown>, callback: Callback): void }
  cancel: { create(request: Record<string, unknown>, callback: Callback): void }
}

type Config = { apiKey: string; secretKey: string; baseUrl: string }

function required(env: Readonly<Record<string, string | undefined>>, name: string): string {
  const value = env[name]?.trim()
  if (!value) throw new Error(`${name} is required for SaaS subscription refunds`)
  return value
}

export function readIyzicoSubscriptionRefundConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): Config {
  if (env.SAAS_BILLING_FINANCIAL_OPS_ENABLED?.trim() !== 'true') {
    throw new Error('SAAS_BILLING_FINANCIAL_OPS_ENABLED must be true for subscription refunds')
  }
  const baseUrl = required(env, 'IYZICO_BILLING_BASE_URL')
  if (baseUrl !== SANDBOX_URL && baseUrl !== LIVE_URL) {
    throw new Error('IYZICO_BILLING_BASE_URL must be an approved iyzico API origin')
  }
  if (env.NODE_ENV === 'production' && baseUrl !== LIVE_URL) {
    throw new Error('IYZICO_BILLING_BASE_URL must use the live origin in production')
  }
  return {
    apiKey: required(env, 'IYZICO_BILLING_API_KEY'),
    secretKey: required(env, 'IYZICO_BILLING_SECRET_KEY'),
    baseUrl,
  }
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function decimalMinor(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const raw = String(value).trim()
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) return null
  const [whole, fraction = ''] = raw.split('.')
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  return Number.isSafeInteger(minor) ? minor : null
}

function signaturePrice(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const raw = String(value).trim()
  if (!/^\d+(?:\.\d+)?$/.test(raw)) return null
  return raw.includes('.') ? raw.replace(/0+$/, '').replace(/\.$/, '') : raw
}

function validSignature(secret: string, parts: readonly string[], supplied: unknown): boolean {
  const signature = text(supplied)?.toLowerCase() ?? ''
  if (!/^[a-f0-9]{64}$/.test(signature)) return false
  const expected = createHmac('sha256', secret).update(parts.join(':'), 'utf8').digest('hex')
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'))
}

function invoke(
  dispatch: (callback: Callback) => void,
  timeoutMs: number,
): Promise<{ kind: 'response'; value: Response } | { kind: 'uncertain'; code: string }> {
  return new Promise((resolve) => {
    let settled = false
    const timer = setTimeout(() => {
      if (!settled) { settled = true; resolve({ kind: 'uncertain', code: 'provider_timeout' }) }
    }, timeoutMs)
    dispatch((error, response) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(error ? { kind: 'uncertain', code: 'provider_transport_error' } : { kind: 'response', value: response })
    })
  })
}

export function createIyzicoSubscriptionRefundProvider(
  config: Config = readIyzicoSubscriptionRefundConfig(),
  options: { client?: IyzicoRefundClient; timeoutMs?: number } = {},
): SubscriptionRefundProvider {
  const client = options.client ?? new Iyzipay({
    apiKey: config.apiKey, secretKey: config.secretKey, uri: config.baseUrl,
  }) as unknown as IyzicoRefundClient
  const timeoutMs = options.timeoutMs ?? TIMEOUT_MS

  return {
    async execute(input): Promise<SubscriptionRefundProviderOutcome> {
      const requestedPrice = (input.amountMinor / 100).toFixed(2)
      const result = await invoke((callback) => {
        const request = {
          locale: 'tr', conversationId: input.refundId,
          paymentId: input.providerPaymentId,
        }
        if (input.kind === 'same_day_cancel') client.cancel.create(request, callback)
        else client.refundV2.create({ ...request, price: requestedPrice, currency: 'TRY' }, callback)
      }, timeoutMs)
      if (result.kind === 'uncertain') return { outcome: 'uncertain', code: result.code }

      const response = result.value
      if (response.status !== 'success') {
        return { outcome: 'rejected', code: text(response.errorCode)?.slice(0, 100) ?? 'provider_rejected' }
      }
      const paymentId = text(response.paymentId)
      const conversationId = text(response.conversationId)
      const currency = text(response.currency)
      const amountMinor = decimalMinor(response.price)
      const providerRefundRef = text(input.kind === 'same_day_cancel'
        ? response.cancelHostReference ?? response.hostReference
        : response.refundHostReference)
      if (paymentId !== input.providerPaymentId || conversationId !== input.refundId
        || currency !== 'TRY' || amountMinor !== input.amountMinor || !providerRefundRef) {
        return { outcome: 'uncertain', code: 'provider_response_mismatch' }
      }
      if (input.kind === 'refund') {
        const price = signaturePrice(response.price)
        if (!price || !validSignature(config.secretKey,
          [paymentId, price, currency, conversationId], response.signature)) {
          return { outcome: 'uncertain', code: 'provider_signature_invalid' }
        }
      }
      return { outcome: 'succeeded', providerPaymentId: paymentId, providerRefundRef, amountMinor }
    },
  }
}
