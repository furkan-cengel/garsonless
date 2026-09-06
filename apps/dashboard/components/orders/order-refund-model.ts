import { isValidOrderRefundAmount } from '@garsonless/domain/orders'

/** Accept decimal input without silently rounding money or interpreting exponents. */
export function parseOrderRefundAmount(text: string, maximum: number): number | null {
  const normalized = text.trim().replace(',', '.')
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null
  const amount = Number(normalized)
  return isValidOrderRefundAmount(amount) && amount <= maximum ? amount : null
}
