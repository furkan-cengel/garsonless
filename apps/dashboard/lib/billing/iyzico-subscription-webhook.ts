import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import type {
  SubscriptionBillingWebhookVerifier,
  VerifiedSubscriptionBillingEvent,
} from '@garsonless/application/billing'
import { err, ok, type Result } from '@garsonless/domain/result'

const MAX_WEBHOOK_BYTES = 64 * 1024
const MAX_REFERENCE_LENGTH = 200
const SUPPORTED_EVENTS = new Map([
  ['subscription.order.success', 'invoice.payment_succeeded'],
  ['subscription.order.failure', 'invoice.payment_failed'],
] as const)

export type IyzicoSubscriptionWebhookConfig = {
  merchantId: string
  secretKey: string
}

type IyzicoSubscriptionWebhookPayload = {
  iyziReferenceCode: string
  iyziEventType: 'subscription.order.success' | 'subscription.order.failure'
  iyziEventTime: number
  subscriptionReferenceCode: string
  orderReferenceCode: string
  customerReferenceCode: string
}

function requiredEnv(name: 'IYZICO_BILLING_MERCHANT_ID' | 'IYZICO_BILLING_SECRET_KEY'): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required for the SaaS billing webhook`)
  return value
}

/** Uses platform subscription credentials only. The generic IYZICO_* tenant
 * payment fallback is intentionally not accepted here. */
export function readIyzicoSubscriptionWebhookConfig(): IyzicoSubscriptionWebhookConfig {
  return {
    merchantId: requiredEnv('IYZICO_BILLING_MERCHANT_ID'),
    secretKey: requiredEnv('IYZICO_BILLING_SECRET_KEY'),
  }
}

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function reference(row: Record<string, unknown>, key: string): string | null {
  const value = row[key]
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 && trimmed.length <= MAX_REFERENCE_LENGTH ? trimmed : null
}

function parsePayload(rawBody: Uint8Array, nowMs: number): Result<IyzicoSubscriptionWebhookPayload> {
  if (rawBody.byteLength === 0 || rawBody.byteLength > MAX_WEBHOOK_BYTES) {
    return err('Iyzico billing webhook body size is invalid')
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(rawBody))
  } catch {
    return err('Iyzico billing webhook body is invalid JSON')
  }
  const row = object(parsed)
  if (!row) return err('Iyzico billing webhook payload is invalid')
  const eventType = row.iyziEventType
  const eventId = reference(row, 'iyziReferenceCode')
  const subscriptionReferenceCode = reference(row, 'subscriptionReferenceCode')
  const orderReferenceCode = reference(row, 'orderReferenceCode')
  const customerReferenceCode = reference(row, 'customerReferenceCode')
  const eventTime = row.iyziEventTime
  if (!SUPPORTED_EVENTS.has(eventType as 'subscription.order.success') || !eventId
    || !subscriptionReferenceCode || !orderReferenceCode || !customerReferenceCode
    || typeof eventTime !== 'number' || !Number.isSafeInteger(eventTime) || eventTime < 1_577_836_800_000
    || eventTime > nowMs + 5 * 60_000) {
    return err('Iyzico billing webhook payload is invalid')
  }
  return ok({
    iyziReferenceCode: eventId,
    iyziEventType: eventType as IyzicoSubscriptionWebhookPayload['iyziEventType'],
    iyziEventTime: eventTime as number,
    subscriptionReferenceCode,
    orderReferenceCode,
    customerReferenceCode,
  })
}

function signatureHeader(headers: Readonly<Record<string, string | undefined>>): string | null {
  const value = headers['x-iyz-signature-v3'] ?? headers['X-IYZ-SIGNATURE-V3']
  const normalized = value?.trim().toLowerCase() ?? ''
  return /^[a-f0-9]{64}$/.test(normalized) ? normalized : null
}

export function signIyzicoSubscriptionWebhookForTest(
  config: IyzicoSubscriptionWebhookConfig,
  payload: Pick<IyzicoSubscriptionWebhookPayload,
    'iyziEventType' | 'subscriptionReferenceCode' | 'orderReferenceCode' | 'customerReferenceCode'>,
): string {
  const message = config.merchantId
    + config.secretKey
    + payload.iyziEventType
    + payload.subscriptionReferenceCode
    + payload.orderReferenceCode
    + payload.customerReferenceCode
  return createHmac('sha256', config.secretKey).update(message, 'utf8').digest('hex')
}

export function createIyzicoSubscriptionWebhookVerifier(
  config: IyzicoSubscriptionWebhookConfig,
  now: () => number = Date.now,
): SubscriptionBillingWebhookVerifier {
  return {
    async verifyWebhook(input): Promise<Result<VerifiedSubscriptionBillingEvent>> {
      const parsed = parsePayload(input.rawBody, now())
      if (!parsed.ok) return parsed
      const supplied = signatureHeader(input.headers)
      if (!supplied) return err('Iyzico billing webhook signature is invalid')
      const expected = signIyzicoSubscriptionWebhookForTest(config, parsed.value)
      if (!timingSafeEqual(Buffer.from(supplied, 'hex'), Buffer.from(expected, 'hex'))) {
        return err('Iyzico billing webhook signature is invalid')
      }
      const internalType = SUPPORTED_EVENTS.get(parsed.value.iyziEventType)
      if (!internalType) return err('Iyzico billing webhook event is unsupported')
      return ok({
        eventId: parsed.value.iyziReferenceCode,
        type: internalType,
        occurredAt: new Date(parsed.value.iyziEventTime).toISOString(),
        providerCustomerRef: parsed.value.customerReferenceCode,
        providerSubscriptionRef: parsed.value.subscriptionReferenceCode,
        providerInvoiceRef: parsed.value.orderReferenceCode,
        providerAttemptRef: parsed.value.orderReferenceCode,
        amount: null,
        sanitizedPayload: {
          iyziReferenceCode: parsed.value.iyziReferenceCode,
          iyziEventType: parsed.value.iyziEventType,
          iyziEventTime: parsed.value.iyziEventTime,
          subscriptionReferenceCode: parsed.value.subscriptionReferenceCode,
          orderReferenceCode: parsed.value.orderReferenceCode,
          customerReferenceCode: parsed.value.customerReferenceCode,
        },
        payloadHash: createHash('sha256').update(input.rawBody).digest('hex'),
      })
    },
  }
}
