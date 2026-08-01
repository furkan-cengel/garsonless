const FORM_MEDIA_TYPE = 'application/x-www-form-urlencoded'
const JSON_MEDIA_TYPE = 'application/json'
const MAX_CHECKOUT_TOKEN_LENGTH = 200

function mediaType(value: string | null): string {
  return value?.split(';', 1)[0]?.trim().toLowerCase() ?? ''
}

export function isBillingCallbackMediaType(value: string | null): boolean {
  return mediaType(value) === FORM_MEDIA_TYPE
}

export function isBillingWebhookMediaType(value: string | null): boolean {
  return mediaType(value) === JSON_MEDIA_TYPE
}

export function declaredBillingBodyTooLarge(value: string | null, maxBytes: number): boolean {
  if (value === null) return false
  if (!/^\d+$/.test(value)) return true
  const size = Number(value)
  return !Number.isSafeInteger(size) || size > maxBytes
}

export function parseBillingCallbackToken(rawBody: Uint8Array): string | null {
  let body: string
  try {
    body = new TextDecoder('utf-8', { fatal: true }).decode(rawBody)
  } catch {
    return null
  }
  const form = new URLSearchParams(body)
  const tokens = form.getAll('token')
  if (tokens.length !== 1) return null
  const token = tokens[0]?.trim() ?? ''
  return token.length > 0 && token.length <= MAX_CHECKOUT_TOKEN_LENGTH
    && /^[\x21-\x7e]+$/.test(token)
    ? token
    : null
}
