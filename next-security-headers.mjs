const BASE_SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
  },
]

/**
 * Baseline browser protections shared by every Next.js application.
 *
 * The public menu has a tenant-aware frame-ancestors policy in middleware so
 * Dashboard previews remain possible. Other applications are never embeddable.
 */
export function createSecurityHeaders({
  allowEmbedding = false,
  noIndex = false,
  analyticsEnabled = false,
  isProduction = false,
  additionalFrameOrigins = /** @type {string[]} */ ([]),
} = {}) {
  // Deployment authorization is separate from the provider/transfer assessment.
  // This switch must never be treated as evidence of legal approval.
  if (analyticsEnabled && isProduction && process.env['ANALYTICS_PRODUCTION_ENABLED'] !== 'true') {
    throw new Error('GA4 requires explicit production activation: ANALYTICS_PRODUCTION_ENABLED=true')
  }
  const frameOrigins = additionalFrameOrigins.map((value) => {
    const url = new URL(value)
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) {
      throw new Error('Frame origins must be HTTP(S) URLs without credentials')
    }
    return url.origin
  })
  const reportOnlyPolicy = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "form-action 'self'",
    "script-src 'self' 'unsafe-inline' https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/" + (analyticsEnabled ? " https://www.googletagmanager.com" : ""),
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co" + (analyticsEnabled ? " https://*.google-analytics.com https://www.googletagmanager.com" : ""),
    ["frame-src 'self' https://www.google.com/recaptcha/ https://recaptcha.google.com/ https://*.supademo.com https://*.iyzipay.com", ...new Set(frameOrigins)].join(' '),
    "worker-src 'self' blob:",
    // Collected by each app's /api/csp-report route before the policy is enforced.
    'report-uri /api/csp-report',
  ].join('; ')
  const headers = BASE_SECURITY_HEADERS.map((header) => ({ ...header }))

  headers.push({ key: 'Content-Security-Policy-Report-Only', value: reportOnlyPolicy })
  if (noIndex) headers.push({ key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' })
  if (isProduction) {
    headers.push({ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' })
  }

  if (!allowEmbedding) {
    headers.push(
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
    )
  }

  return headers
}
