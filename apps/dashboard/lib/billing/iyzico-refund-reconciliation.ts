import { err, ok, type Result } from '@garsonless/domain/result'

type JsonObject = Record<string, unknown>

export type IyzicoRefundReportingEvidence = {
  providerRefundRef: string
  providerRefundedAt: string
  verificationNote: 'iyzico_reporting:totally_refunded'
}

function object(value: unknown): JsonObject | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonObject : null
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function paymentReference(value: unknown): string | null {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return String(value)
  return text(value)
}

function amountMinor(value: unknown): number | null {
  const numeric = typeof value === 'number' ? value
    : typeof value === 'string' && /^\d+(?:\.\d{1,2})?$/.test(value.trim())
      ? Number(value) : Number.NaN
  const minor = Math.round(numeric * 100)
  return Number.isFinite(numeric) && Number.isSafeInteger(minor) && minor > 0 ? minor : null
}

function refundSucceeded(value: unknown): boolean {
  return value === 1 || text(value)?.toUpperCase() === 'SUCCESS'
}

function normalizedRefundedAt(value: unknown, requestedAt: number): string | null {
  const raw = Date.parse(text(value) ?? '')
  if (!Number.isFinite(raw)) return null
  // Reporting has been observed to serialize Europe/Istanbul wall time with a
  // `Z` suffix. Accept either real UTC or the fixed UTC+03 wall-clock variant,
  // choosing only the candidate close to the synchronous local request.
  const candidates = [raw, raw - 3 * 60 * 60 * 1_000]
  const closest = candidates.reduce((best, candidate) =>
    Math.abs(candidate - requestedAt) < Math.abs(best - requestedAt) ? candidate : best)
  return Math.abs(closest - requestedAt) <= 15 * 60 * 1_000
    ? new Date(closest).toISOString() : null
}

export function verifyIyzicoFullRefundReportingEvidence(
  response: unknown,
  input: { providerPaymentId: string; amountMinor: number; requestedAt: string },
): Result<IyzicoRefundReportingEvidence> {
  const root = object(response)
  if (text(root?.status)?.toLowerCase() !== 'success') return err('Iyzico reporting lookup failed')
  const payment = array(root?.payments).map(object).find((candidate) =>
    paymentReference(candidate?.paymentId) === input.providerPaymentId)
  if (!payment || text(payment.paymentRefundStatus)?.toUpperCase() !== 'TOTALLY_REFUNDED') {
    return err('Iyzico reporting does not prove a total refund')
  }
  if (amountMinor(payment.price) !== input.amountMinor || text(payment.currency)?.toUpperCase() !== 'TRY') {
    return err('Iyzico reporting payment identity does not match')
  }
  const requestedAt = Date.parse(input.requestedAt)
  if (!Number.isFinite(requestedAt)) return err('Refund request timestamp is invalid')
  const refund = array(payment.cancels).map(object).find((candidate) => {
    return refundSucceeded(candidate?.refundStatus)
      && amountMinor(candidate?.refundPrice) === input.amountMinor
      && text(candidate?.currencyCode)?.toUpperCase() === 'TRY'
      && normalizedRefundedAt(candidate?.createdDate, requestedAt) !== null
  })
  const refundId = paymentReference(refund?.refundId)
  const providerRefundedAt = normalizedRefundedAt(refund?.createdDate, requestedAt)
  if (!refundId || !providerRefundedAt) {
    return err('Iyzico reporting refund evidence is incomplete')
  }
  return ok({
    providerRefundRef: `iyzico-reporting-refund:${refundId}`,
    providerRefundedAt,
    verificationNote: 'iyzico_reporting:totally_refunded',
  })
}
