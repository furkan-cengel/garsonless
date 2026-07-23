import type {
  NormalizedPlatformErrorFilter,
  PlatformErrorFingerprint,
  PlatformErrorOverview,
  PlatformErrorReadPort,
} from '@garsonless/application/platform-admin-errors'
import { isPublicErrorCode } from '@garsonless/domain/errors'
import {
  isPlatformErrorApp,
  isPlatformErrorSeverity,
  isPlatformErrorSource,
  type PlatformErrorEventInput,
} from '@garsonless/domain/platform-observability'
import { err, ok } from '@garsonless/domain/result'
import { createServiceClient } from './client'

type RpcResult = { data: unknown; error: { message: string } | null }
export type PlatformErrorRpc = (
  name: 'record_platform_error_event' | 'read_platform_admin_error_overview',
  args: Record<string, unknown>,
) => PromiseLike<RpcResult>

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const FINGERPRINT = /^[0-9a-f]{32}$/
const REFERENCE_ID = /^[A-Za-z0-9-]{8,64}$/

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid object')
  return value as Record<string, unknown>
}

function count(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error('invalid count')
  return value as number
}

function timestamp(value: unknown): string {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) throw new Error('invalid timestamp')
  return value
}

function parseFingerprint(value: unknown): PlatformErrorFingerprint {
  const row = record(value)
  const sample = row.sampleTenant === null ? null : record(row.sampleTenant)
  if (
    typeof row.fingerprint !== 'string' || !FINGERPRINT.test(row.fingerprint)
    || !isPlatformErrorApp(row.app)
    || !isPlatformErrorSource(row.source)
    || !isPublicErrorCode(row.publicCode)
    || !isPlatformErrorSeverity(row.severity)
  ) throw new Error('invalid platform error fingerprint')
  if (
    sample !== null
    && (
      typeof sample.id !== 'string' || !UUID.test(sample.id)
      || typeof sample.name !== 'string' || sample.name.length < 1
    )
  ) throw new Error('invalid sample tenant')
  return {
    fingerprint: row.fingerprint,
    app: row.app,
    source: row.source,
    publicCode: row.publicCode,
    severity: row.severity,
    occurrenceCount: count(row.occurrenceCount),
    affectedTenantCount: count(row.affectedTenantCount),
    firstSeenAt: timestamp(row.firstSeenAt),
    lastSeenAt: timestamp(row.lastSeenAt),
    sampleTenant: sample === null ? null : { id: sample.id as string, name: sample.name as string },
  }
}

function parseOverview(value: unknown): PlatformErrorOverview {
  const row = record(value)
  if (!Array.isArray(row.items)) throw new Error('invalid platform error overview')
  return {
    eventCount: count(row.eventCount),
    fingerprintCount: count(row.fingerprintCount),
    criticalFingerprintCount: count(row.criticalFingerprintCount),
    affectedTenantCount: count(row.affectedTenantCount),
    items: row.items.map(parseFingerprint),
  }
}

function createRpc(rpc?: PlatformErrorRpc): PlatformErrorRpc {
  if (rpc) return rpc
  const service = createServiceClient()
  return service.rpc.bind(service) as unknown as PlatformErrorRpc
}

export function createPlatformErrorReadPort(rpc?: PlatformErrorRpc): PlatformErrorReadPort {
  return {
    async readOverview(input: NormalizedPlatformErrorFilter) {
      try {
        const { data, error } = await createRpc(rpc)('read_platform_admin_error_overview', {
          p_window: input.window,
          p_app: input.app,
          p_severity: input.severity,
          p_limit: input.limit,
        })
        if (error) return err('platform_error_overview_query_failed')
        return ok(parseOverview(data))
      } catch {
        return err('platform_error_overview_query_failed')
      }
    },
  }
}

export async function recordPlatformErrorEvent(
  input: PlatformErrorEventInput,
  rpc?: PlatformErrorRpc,
): Promise<string> {
  if (
    !isPlatformErrorApp(input.app)
    || !isPlatformErrorSource(input.source)
    || !isPublicErrorCode(input.publicCode)
    || !isPlatformErrorSeverity(input.severity)
    || (input.restaurantId != null && !UUID.test(input.restaurantId))
    || (input.referenceId != null && !REFERENCE_ID.test(input.referenceId))
    || (input.occurredAt != null && Number.isNaN(Date.parse(input.occurredAt)))
  ) throw new Error('invalid_platform_error_event')

  const { data, error } = await createRpc(rpc)('record_platform_error_event', {
    p_restaurant_id: input.restaurantId ?? null,
    p_app: input.app,
    p_source: input.source,
    p_public_code: input.publicCode,
    p_severity: input.severity,
    p_reference_id: input.referenceId ?? null,
    p_occurred_at: input.occurredAt ?? new Date().toISOString(),
  })
  if (error || typeof data !== 'string' || !FINGERPRINT.test(data)) {
    throw new Error('platform_error_event_record_failed')
  }
  return data
}
