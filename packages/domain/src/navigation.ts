const PLACEHOLDER_ORIGIN = 'https://return-path.invalid'
const MAX_RETURN_PATH_LENGTH = 2_048
// A same-origin path starts with exactly one slash. `//host` and `/\host` are
// protocol-relative URLs once a browser resolves them against the page.
const SAME_ORIGIN_PATH = /^\/(?![/\\])/

/**
 * Normalizes an untrusted redirect target to a same-origin path, or returns
 * `fallback`. The normalized value is checked again because dot segments
 * collapse during parsing: `/.//evil.com` becomes `//evil.com`, which a
 * browser treats as another host.
 */
export function safeReturnPath(value: string | null | undefined, fallback: string): string {
  if (!value || value.length > MAX_RETURN_PATH_LENGTH || !SAME_ORIGIN_PATH.test(value)) return fallback
  try {
    const parsed = new URL(value, PLACEHOLDER_ORIGIN)
    if (parsed.origin !== PLACEHOLDER_ORIGIN) return fallback
    const normalized = `${parsed.pathname}${parsed.search}${parsed.hash}`
    return SAME_ORIGIN_PATH.test(normalized) ? normalized : fallback
  } catch {
    return fallback
  }
}
