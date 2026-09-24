import { readBoundedRequestBody } from './request-body'

export const CSP_REPORT_APPS = ['dashboard', 'menu', 'kitchen', 'marketing', 'platform-admin'] as const
export type CspReportApp = (typeof CSP_REPORT_APPS)[number]

export interface CspViolation {
  directive: string
  /** A CSP keyword (`inline`, `eval`, `data`, …) or the blocked origin; never a full URL. */
  blocked: string
  /** Document path with ids and tokens masked; never a query string. */
  path: string
  sourceOrigin: string | null
  disposition: 'report' | 'enforce'
}

const MAX_REPORT_BYTES = 16 * 1024
const MAX_REPORTS_PER_REQUEST = 20
const LOG_WINDOW_MS = 60_000
const MAX_TRACKED_KEYS = 500
const EXTENSION_SCHEME = /^(?:chrome|moz|safari|safari-web|ms-browser)-extension:/i
const BLOCKED_KEYWORDS = new Set(['inline', 'eval', 'wasm-eval', 'data', 'blob', 'self', 'trusted-types-policy', 'trusted-types-sink'])
// Path segments that identify a tenant, table, order or credential. Masking
// them keeps QR table tokens and similar secrets out of the logs.
const SENSITIVE_SEGMENT = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[A-Za-z0-9_-]{24,})$/i

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, 2_048) : ''
}

function maskedPath(value: string): string {
  try {
    const { pathname } = new URL(value, 'https://csp-report.invalid')
    const masked = pathname.split('/').map((segment) => SENSITIVE_SEGMENT.test(segment) ? ':id' : segment).join('/')
    return masked.slice(0, 200) || '/'
  } catch {
    return 'unknown'
  }
}

function originOf(value: string): string | null {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'wss:' ? url.origin : `${url.protocol}`
  } catch {
    return null
  }
}

function blockedValue(value: string): string {
  const lowered = value.toLowerCase()
  if (!lowered) return 'unknown'
  if (BLOCKED_KEYWORDS.has(lowered)) return lowered
  if (lowered.endsWith(':') && /^[a-z][a-z0-9+.-]*:$/.test(lowered)) return lowered.slice(0, -1)
  return originOf(value) ?? 'unknown'
}

function directiveValue(value: string): string {
  const first = value.toLowerCase().split(/\s+/, 1)[0] ?? ''
  return /^[a-z-]{1,40}$/.test(first) ? first : 'unknown'
}

function normalizeViolation(body: Record<string, unknown>, legacy: boolean): CspViolation | null {
  const blockedRaw = text(legacy ? body['blocked-uri'] : body['blockedURL'])
  const sourceRaw = text(legacy ? body['source-file'] : body['sourceFile'])
  if (EXTENSION_SCHEME.test(blockedRaw) || EXTENSION_SCHEME.test(sourceRaw)) return null
  const directive = directiveValue(text(legacy
    ? body['effective-directive'] || body['violated-directive']
    : body['effectiveDirective']))
  const disposition = text(body['disposition']) === 'enforce' ? 'enforce' : 'report'
  return {
    directive,
    blocked: blockedValue(blockedRaw),
    path: maskedPath(text(legacy ? body['document-uri'] : body['documentURL'])),
    sourceOrigin: sourceRaw ? originOf(sourceRaw) : null,
    disposition,
  }
}

/** Accepts both the legacy `report-uri` body and Reporting API batches. */
export function normalizeCspReports(payload: unknown): CspViolation[] {
  const legacy = record(record(payload)?.['csp-report'])
  if (legacy) {
    const violation = normalizeViolation(legacy, true)
    return violation ? [violation] : []
  }
  if (!Array.isArray(payload)) return []
  return payload.slice(0, MAX_REPORTS_PER_REQUEST).flatMap((entry) => {
    const report = record(entry)
    const body = record(report?.['body'])
    if (report?.['type'] !== 'csp-violation' || !body) return []
    const violation = normalizeViolation(body, false)
    return violation ? [violation] : []
  })
}

/** Logs each distinct violation at most once per window, carrying the suppressed count. */
export function createCspViolationThrottle(windowMs = LOG_WINDOW_MS) {
  const seen = new Map<string, { windowStart: number; suppressed: number }>()
  return (key: string, now: number): { log: boolean; suppressed: number } => {
    const entry = seen.get(key)
    if (entry && now - entry.windowStart < windowMs) {
      entry.suppressed += 1
      return { log: false, suppressed: 0 }
    }
    if (!entry && seen.size >= MAX_TRACKED_KEYS) seen.clear()
    seen.set(key, { windowStart: now, suppressed: 0 })
    return { log: true, suppressed: entry?.suppressed ?? 0 }
  }
}

const defaultThrottle = createCspViolationThrottle()

export async function handleCspReport(
  request: Request,
  app: CspReportApp,
  options: {
    log?: (line: string) => void
    now?: () => number
    throttle?: ReturnType<typeof createCspViolationThrottle>
  } = {},
): Promise<Response> {
  const log = options.log ?? ((line: string) => console.warn(line))
  const now = options.now ?? Date.now
  const throttle = options.throttle ?? defaultThrottle
  const noContent = () => new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })

  const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
  if (contentType !== 'application/csp-report' && contentType !== 'application/reports+json' && contentType !== 'application/json') {
    return noContent()
  }
  const body = await readBoundedRequestBody(request, MAX_REPORT_BYTES)
  if (!body.ok) return noContent()
  let payload: unknown
  try {
    payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body.bytes))
  } catch {
    return noContent()
  }

  for (const violation of normalizeCspReports(payload)) {
    const key = [app, violation.directive, violation.blocked, violation.path, violation.disposition].join('|')
    const decision = throttle(key, now())
    if (!decision.log) continue
    log(JSON.stringify({ event: 'csp.violation', app, ...violation, suppressedSinceLastLog: decision.suppressed }))
  }
  return noContent()
}
