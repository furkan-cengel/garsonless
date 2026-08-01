export const MAX_ANALYTICS_RESPONSE_BYTES = 1_500_000

export function serializeAnalyticsResponse(value: unknown) {
  const body = JSON.stringify(value)
  const bytes = new TextEncoder().encode(body).byteLength
  return { body, bytes, withinBudget: bytes <= MAX_ANALYTICS_RESPONSE_BYTES }
}
