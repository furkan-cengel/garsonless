export function resolveFrameAncestors({
  isThemePreview,
  configuredOrigins,
  isProduction,
}: {
  isThemePreview: boolean
  configuredOrigins: string | undefined
  isProduction: boolean
}): string[] {
  if (!isThemePreview) return []
  const origins = (configuredOrigins ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .flatMap((value) => {
      try {
        const url = new URL(value)
        return url.protocol === 'http:' || url.protocol === 'https:' ? [url.origin] : []
      } catch {
        return []
      }
    })
  if (!isProduction) {
    origins.push(
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:3004',
      'http://127.0.0.1:3004',
    )
  }
  return [...new Set(origins)]
}

export function frameAncestorsDirective(origins: readonly string[]): string {
  return `frame-ancestors ${origins.length > 0 ? origins.join(' ') : "'none'"}`
}

export function shouldApplyMenuFrameAncestors(pathname: string): boolean {
  // The provider POSTs this document into a same-origin payment iframe. The
  // callback route owns a stricter nonce-based CSP with frame-ancestors 'self'.
  return pathname !== '/api/payment/callback'
}
