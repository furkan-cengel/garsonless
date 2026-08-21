// Centralized phone normalization → E.164. Used by request-otp, verify-otp,
// and (Phase 2) earning, so the same human never splits into two customer rows.
// Default country: Turkey (+90). Turkish mobile numbers are 10 digits starting
// with 5 (national form 05XXXXXXXXX).

/** A 10-digit national TR part (optionally with a leading 0) → "+905XXXXXXXXX" or null. */
function trNational(part: string): string | null {
  let s = part
  if (s.length === 11 && s.startsWith('0')) s = s.slice(1) // 0532... → 532...
  if (s.length === 10 && s.startsWith('5')) return `+90${s}`
  return null
}

/**
 * Normalize messy user input to canonical E.164.
 * TR examples that all map to "+905321234567":
 *   "0532 123 45 67", "532-123-4567", "+90 532 123 45 67",
 *   "905321234567", "+905321234567", "0090 532 123 45 67"
 * Non-TR numbers entered with an explicit "+<cc>" pass through as generic E.164.
 * Returns null for anything that isn't a plausible phone number.
 */
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null
  const raw = String(input).trim()
  if (!raw) return null

  const hasPlus = raw.startsWith('+')
  const digits = raw.replace(/\D/g, '') // strip spaces, dashes, parens, letters
  if (!digits) return null

  // Country-code form: from a leading "+" or an "00" international access prefix.
  let cc: string | null = null
  if (hasPlus) cc = digits
  else if (digits.startsWith('00')) cc = digits.slice(2)

  if (cc !== null) {
    if (cc.startsWith('90')) return trNational(cc.slice(2)) // TR with country code
    // Generic E.164 for other countries: 8–15 total digits.
    if (cc.length >= 8 && cc.length <= 15) return `+${cc}`
    return null
  }

  // National form, assume TR (+90).
  if (digits.length === 12 && digits.startsWith('90')) return trNational(digits.slice(2))
  return trNational(digits)
}

/** Netgsm customer-auth boundary: Turkey mobile numbers only. */
export function normalizeTurkishMobile(input: string | null | undefined): string | null {
  const normalized = normalizePhone(input)
  return normalized && /^\+905\d{9}$/.test(normalized) ? normalized : null
}
