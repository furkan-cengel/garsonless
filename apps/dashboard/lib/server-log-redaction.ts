const SENSITIVE_KEY_PATTERN = /(authorization|cookie|password|passphrase|secret|token|api[_-]?key|credential)/i
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g
const BEARER_PATTERN = /\bBearer\s+[^\s,;]+/gi
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi
const PHONE_PATTERN = /(?<!\w)(?:\+?\d[\d\s().-]{7,}\d)(?!\w)/g
const ASSIGNED_SECRET_PATTERN = /\b(api[_-]?key|secret[_-]?key|password|token)\s*[:=]\s*[^\s,;]+/gi

export function redactDiagnosticText(value: string): string {
  return value
    .replace(BEARER_PATTERN, 'Bearer [REDACTED]')
    .replace(JWT_PATTERN, '[REDACTED_TOKEN]')
    .replace(ASSIGNED_SECRET_PATTERN, '$1=[REDACTED]')
    .replace(EMAIL_PATTERN, '[REDACTED_EMAIL]')
    .replace(UUID_PATTERN, '[REDACTED_UUID]')
    .replace(PHONE_PATTERN, '[REDACTED_PHONE]')
}

function sanitizeValue(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (depth > 4) return '[TRUNCATED]'
  if (typeof value === 'string') return redactDiagnosticText(value).slice(0, 2_000)
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'undefined') return '[UNDEFINED]'
  if (typeof value === 'function' || typeof value === 'symbol') return `[${typeof value}]`
  if (typeof value !== 'object') return '[UNKNOWN]'
  if (seen.has(value)) return '[CIRCULAR]'
  seen.add(value)

  if (value instanceof Error) {
    const safe: Record<string, unknown> = {
      name: redactDiagnosticText(value.name),
      message: redactDiagnosticText(value.message),
    }
    const code = (value as Error & { code?: unknown }).code
    if (typeof code === 'string' && !SENSITIVE_KEY_PATTERN.test(code)) safe['code'] = redactDiagnosticText(code)
    return safe
  }
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeValue(item, depth + 1, seen))

  const safe: Record<string, unknown> = {}
  for (const [key, nested] of Object.entries(value).slice(0, 30)) {
    safe[key] = SENSITIVE_KEY_PATTERN.test(key)
      ? '[REDACTED]'
      : sanitizeValue(nested, depth + 1, seen)
  }
  return safe
}

/** Builds a bounded diagnostic value which is safe to pass to server logs. */
export function sanitizeServerDiagnostic(value: unknown): unknown {
  return sanitizeValue(value, 0, new WeakSet<object>())
}
