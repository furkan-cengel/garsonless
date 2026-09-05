const ORDER_PAYMENT_SUCCESS = 'PAYMENT_SUCCESS' as const
const SHARE_PAYMENT_SUCCESS = 'SHARE_PAYMENT_SUCCESS' as const
const PAYMENT_FAILED = 'PAYMENT_FAILED' as const

export type PaymentCallbackMessage =
  | { type: typeof ORDER_PAYMENT_SUCCESS; orderId: string }
  | { type: typeof SHARE_PAYMENT_SUCCESS; shareId: string }
  | { type: typeof PAYMENT_FAILED; reason: string }

export type PaymentCallbackOutcome =
  | { status: 'success' }
  | { status: 'failed'; reason: string }

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function parsePaymentCallbackMessage(value: unknown): PaymentCallbackMessage | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Record<string, unknown>

  if (candidate['type'] === ORDER_PAYMENT_SUCCESS && nonEmptyString(candidate['orderId'])) {
    return { type: ORDER_PAYMENT_SUCCESS, orderId: candidate['orderId'] }
  }
  if (candidate['type'] === SHARE_PAYMENT_SUCCESS && nonEmptyString(candidate['shareId'])) {
    return { type: SHARE_PAYMENT_SUCCESS, shareId: candidate['shareId'] }
  }
  if (candidate['type'] === PAYMENT_FAILED && nonEmptyString(candidate['reason'])) {
    return { type: PAYMENT_FAILED, reason: candidate['reason'] }
  }
  return null
}

export function readTrustedPaymentCallbackMessage(
  event: Pick<MessageEvent, 'data' | 'origin' | 'source'>,
  expectedOrigin: string,
  expectedSource: MessageEventSource | null | undefined,
): PaymentCallbackMessage | null {
  if (!expectedSource || event.source !== expectedSource || event.origin !== expectedOrigin) {
    return null
  }
  return parsePaymentCallbackMessage(event.data)
}

export function resolvePaymentCallbackOutcome(
  flow: 'order' | 'share',
  message: PaymentCallbackMessage,
): PaymentCallbackOutcome | null {
  if (message.type === PAYMENT_FAILED) {
    return { status: 'failed', reason: message.reason }
  }
  if (flow === 'order' && message.type === ORDER_PAYMENT_SUCCESS) {
    return { status: 'success' }
  }
  if (flow === 'share' && message.type === SHARE_PAYMENT_SUCCESS) {
    return { status: 'success' }
  }
  return null
}
