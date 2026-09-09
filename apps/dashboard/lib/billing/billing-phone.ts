export const INVALID_BILLING_PHONE = 'Billing customer phone number is invalid'
export const BILLING_PHONE_GUIDANCE = 'Geçerli bir cep telefonu numarası girin (05xx xxx xx xx veya +90 5xx xxx xx xx).'

/** Canonical provider format; unprefixed numbers are interpreted only as Turkish mobiles. */
export function normalizeBillingPhone(input: string): string | null {
  const compact = input.trim().replace(/[\s().-]/g, '')
  if (!/^\+?\d+$/.test(compact)) return null
  let value = compact.startsWith('00') ? `+${compact.slice(2)}` : compact
  if (/^05\d{9}$/.test(value)) value = `+9${value}`
  else if (/^5\d{9}$/.test(value)) value = `+90${value}`
  else if (/^905\d{9}$/.test(value)) value = `+${value}`
  // Accept the common redundant national prefix after Turkey's country code.
  if (/^\+9005\d{9}$/.test(value)) value = `+90${value.slice(4)}`
  if (value.startsWith('+90')) return /^\+905\d{9}$/.test(value) ? value : null
  return /^\+[1-9]\d{7,14}$/.test(value) ? value : null
}
