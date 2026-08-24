import { createHash } from 'node:crypto'
import type {
  IntegrationHealth,
  TenantPrivacyOperation,
  TenantPrivacyOperationType,
} from '@garsonless/application/settings'
import { createServiceClient } from './client'

type RpcResult = { data: unknown; error: { code?: string; message: string } | null }

function serviceRpc() {
  const service = createServiceClient()
  return service.rpc.bind(service) as unknown as (name: string, args: Record<string, unknown>) => Promise<RpcResult>
}

function rateLimitHash(subject: string): string {
  const salt = process.env['DASHBOARD_AUTH_RATE_LIMIT_SALT']?.trim()
    || process.env['SUPABASE_SERVICE_ROLE_KEY']?.trim()
  if (!salt) throw new Error('Dashboard rate-limit salt is not configured')
  return createHash('sha256').update(`${salt}:${subject.trim().toLowerCase()}`).digest('hex')
}

export async function consumeDashboardAuthRateLimit(input: {
  action: string
  subject: string
  limit: number
  windowSeconds: number
}): Promise<{ ok: true; allowed: boolean } | { ok: false }> {
  try {
    const { data, error } = await serviceRpc()('consume_dashboard_auth_rate_limit', {
      p_subject_hash: rateLimitHash(input.subject),
      p_action: input.action,
      p_limit: input.limit,
      p_window_seconds: input.windowSeconds,
    })
    return error || typeof data !== 'boolean' ? { ok: false } : { ok: true, allowed: data }
  } catch {
    return { ok: false }
  }
}

export async function updateRestaurantTimezoneCas(input: {
  restaurantId: string
  actorUserId: string
  timezone: string
  expectedTimezone: string
  requestId: string
}): Promise<
  | { ok: true; value: { outcome: 'applied'; timezone: string; idempotent: boolean } }
  | { ok: true; value: { outcome: 'conflict'; timezone: string; idempotent: false } }
  | { ok: false; error: string }
> {
  const { data, error } = await serviceRpc()('update_restaurant_timezone_cas', {
    p_restaurant_id: input.restaurantId,
    p_actor_user_id: input.actorUserId,
    p_timezone: input.timezone,
    p_expected_timezone: input.expectedTimezone,
    p_request_id: input.requestId,
  })
  if (error || !data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, error: error?.message ?? 'timezone_update_failed' }
  }
  const row = data as Record<string, unknown>
  if ((row['outcome'] !== 'applied' && row['outcome'] !== 'conflict') || typeof row['timezone'] !== 'string') {
    return { ok: false, error: 'timezone_update_failed' }
  }
  return row['outcome'] === 'conflict'
    ? { ok: true, value: { outcome: 'conflict', timezone: row['timezone'], idempotent: false } }
    : { ok: true, value: { outcome: 'applied', timezone: row['timezone'], idempotent: row['idempotent'] === true } }
}

export async function requestTenantPrivacyOperation(input: {
  restaurantId: string
  actorUserId: string
  operationType: TenantPrivacyOperationType
  reason: string
  requestId: string
}): Promise<{ ok: true; value: TenantPrivacyOperation } | { ok: false; error: string }> {
  const { data, error } = await serviceRpc()('request_tenant_privacy_operation', {
    p_restaurant_id: input.restaurantId,
    p_actor_user_id: input.actorUserId,
    p_operation_type: input.operationType,
    p_reason: input.reason,
    p_request_id: input.requestId,
  })
  if (error || !data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, error: error?.message ?? 'privacy_request_failed' }
  }
  const row = data as Record<string, unknown>
  if (typeof row['id'] !== 'string' || typeof row['status'] !== 'string') {
    return { ok: false, error: 'privacy_request_failed' }
  }
  return {
    ok: true,
    value: {
      id: row['id'],
      operationType: input.operationType,
      status: row['status'] as TenantPrivacyOperation['status'],
      duplicate: row['duplicate'] === true,
    },
  }
}

export async function createTenantPrivacyExport(input: {
  restaurantId: string
  actorUserId: string
  reason: string
  requestId: string
}): Promise<{ ok: true; value: TenantPrivacyOperation & { document: unknown; digest: string } } | { ok: false; error: string }> {
  const { data, error } = await serviceRpc()('export_owner_tenant_privacy_data', {
    p_restaurant_id: input.restaurantId,
    p_actor_user_id: input.actorUserId,
    p_reason: input.reason,
    p_request_id: input.requestId,
  })
  if (error || !data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, error: error?.message ?? 'privacy_export_failed' }
  }
  const row = data as Record<string, unknown>
  if (typeof row['id'] !== 'string' || typeof row['status'] !== 'string'
    || typeof row['digest'] !== 'string' || row['document'] === undefined) {
    return { ok: false, error: 'privacy_export_failed' }
  }
  return {
    ok: true,
    value: {
      id: row['id'],
      operationType: 'export',
      status: row['status'] as TenantPrivacyOperation['status'],
      duplicate: row['duplicate'] === true,
      document: row['document'],
      digest: row['digest'],
    },
  }
}

export async function readRestaurantIntegrationHealth(
  restaurantId: string,
): Promise<{ ok: true; value: IntegrationHealth[] } | { ok: false; error: string }> {
  const service = createServiceClient()
  const { data, error } = await service.from('restaurant_integration_health' as never)
    .select('provider, mode, status, last_checked_at, last_success_at, error_code')
    .eq('restaurant_id', restaurantId)
  if (error) return { ok: false, error: error.message }
  return {
    ok: true,
    value: ((data ?? []) as unknown as Array<Record<string, unknown>>).map((row) => ({
      provider: row['provider'] === 'resend' ? 'resend' : 'iyzico',
      mode: row['mode'] === 'platform' || row['mode'] === 'live' ? row['mode'] : 'sandbox',
      state: row['status'] === 'healthy' || row['status'] === 'error' || row['status'] === 'untested'
        ? row['status']
        : 'unconfigured',
      lastCheckedAt: typeof row['last_checked_at'] === 'string' ? row['last_checked_at'] : null,
      lastSuccessAt: typeof row['last_success_at'] === 'string' ? row['last_success_at'] : null,
      errorCode: typeof row['error_code'] === 'string' ? row['error_code'] : null,
    })),
  }
}

export async function recordRestaurantIntegrationHealth(input: {
  restaurantId: string
  health: IntegrationHealth
}): Promise<{ ok: true } | { ok: false }> {
  const service = createServiceClient()
  const { error } = await service.from('restaurant_integration_health' as never).upsert({
    restaurant_id: input.restaurantId,
    provider: input.health.provider,
    mode: input.health.mode,
    status: input.health.state,
    last_checked_at: input.health.lastCheckedAt,
    last_success_at: input.health.lastSuccessAt,
    error_code: input.health.errorCode,
    updated_at: new Date().toISOString(),
  } as never)
  return error ? { ok: false } : { ok: true }
}
