import {
  platformAdminCan,
  type PlatformAdminActorContext,
} from '@garsonless/domain/platform-admin'
import {
  isPlatformErrorApp,
  isPlatformErrorSeverity,
  isPlatformErrorWindow,
  type PlatformErrorApp,
  type PlatformErrorSeverity,
  type PlatformErrorWindow,
} from '@garsonless/domain/platform-observability'
import type { PublicErrorCode } from '@garsonless/domain/errors'
import { err, type Result } from '@garsonless/domain/result'

export type PlatformErrorFilterInput = {
  window?: PlatformErrorWindow | null
  app?: PlatformErrorApp | 'all' | null
  severity?: PlatformErrorSeverity | 'all' | null
  limit?: number | null
}

export type NormalizedPlatformErrorFilter = {
  window: PlatformErrorWindow
  app: PlatformErrorApp | null
  severity: PlatformErrorSeverity | null
  limit: 25 | 50 | 100
}

export type PlatformErrorFingerprint = {
  fingerprint: string
  app: PlatformErrorApp
  source: string
  publicCode: PublicErrorCode
  severity: PlatformErrorSeverity
  occurrenceCount: number
  affectedTenantCount: number
  firstSeenAt: string
  lastSeenAt: string
  sampleTenant: {
    id: string
    name: string
  } | null
}

export type PlatformErrorOverview = {
  eventCount: number
  fingerprintCount: number
  criticalFingerprintCount: number
  affectedTenantCount: number
  items: PlatformErrorFingerprint[]
}

export interface PlatformErrorReadPort {
  readOverview(input: NormalizedPlatformErrorFilter): Promise<Result<PlatformErrorOverview>>
}

export type PlatformErrorReadError =
  | 'Not authorized'
  | 'Invalid error query'
  | 'Error overview could not be loaded'

const LIMITS = [25, 50, 100] as const

function normalizeFilter(input: PlatformErrorFilterInput): NormalizedPlatformErrorFilter | null {
  const window = input.window ?? '24h'
  const app = input.app == null || input.app === 'all' ? null : input.app
  const severity = input.severity == null || input.severity === 'all' ? null : input.severity
  const limit = input.limit ?? 50
  if (
    !isPlatformErrorWindow(window)
    || (app !== null && !isPlatformErrorApp(app))
    || (severity !== null && !isPlatformErrorSeverity(severity))
    || !LIMITS.includes(limit as typeof LIMITS[number])
  ) return null
  return { window, app, severity, limit: limit as NormalizedPlatformErrorFilter['limit'] }
}

export async function readPlatformErrorOverview(
  actor: PlatformAdminActorContext,
  input: PlatformErrorFilterInput,
  port: PlatformErrorReadPort,
): Promise<Result<PlatformErrorOverview, PlatformErrorReadError>> {
  if (!platformAdminCan(actor, 'tenants.read')) return err('Not authorized')
  const normalized = normalizeFilter(input)
  if (!normalized) return err('Invalid error query')
  const result = await port.readOverview(normalized)
  return result.ok ? result : err('Error overview could not be loaded')
}
