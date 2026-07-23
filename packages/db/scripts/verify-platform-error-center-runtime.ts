import { createClient } from '@supabase/supabase-js'
import { readPlatformErrorOverview } from '@garsonless/application/platform-admin-errors'
import type { PlatformAdminActorContext } from '@garsonless/domain/platform-admin'
import { createServiceClient } from '../src/client'
import {
  createPlatformErrorReadPort,
  recordPlatformErrorEvent,
  type PlatformErrorRpc,
} from '../src/platform-error-event-port'

function env(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing environment variable: ${name}`)
  return value
}

type RuntimeRpcResult = {
  data: unknown
  error: { code?: string; message: string } | null
}
type RuntimeRpc = (
  name: 'record_platform_error_event' | 'read_platform_admin_error_overview',
  args: Record<string, unknown>,
) => PromiseLike<RuntimeRpcResult>

async function main() {
  const service = createServiceClient()
  const serviceRpc = service.rpc.bind(service) as unknown as PlatformErrorRpc
  const anon = createClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('NEXT_PUBLIC_SUPABASE_ANON_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const anonRpc = anon.rpc.bind(anon) as unknown as RuntimeRpc
  const actor: PlatformAdminActorContext = {
    actor: 'platform-admin',
    userId: '11111111-1111-4111-8111-111111111111',
    role: 'support',
    aal: 'aal2',
  }

  const { data: restaurant, error: restaurantError } = await service
    .from('restaurants')
    .select('id,name')
    .is('deleted_at', null)
    .limit(1)
    .single()
  if (restaurantError || !restaurant) throw new Error('No active DEV tenant found')

  const source = 'runtime.phase68'
  await service.from('platform_error_events').delete().eq('source', source)

  let verificationError: unknown = null
  try {
    const firstFingerprint = await recordPlatformErrorEvent({
      restaurantId: restaurant.id,
      app: 'platform-admin',
      source,
      publicCode: 'MAS-SVC-503',
      severity: 'warning',
    }, serviceRpc)
    const replayFingerprint = await recordPlatformErrorEvent({
      restaurantId: restaurant.id,
      app: 'platform-admin',
      source,
      publicCode: 'MAS-SVC-503',
      severity: 'critical',
    }, serviceRpc)

    const overview = await readPlatformErrorOverview(actor, {
      window: '1h',
      app: 'platform-admin',
      limit: 25,
    }, createPlatformErrorReadPort(serviceRpc))
    if (!overview.ok) throw new Error(overview.error)
    const item = overview.value.items.find((candidate) => candidate.fingerprint === firstFingerprint)
    if (!item) throw new Error('Runtime fingerprint was not projected')

    const critical = await readPlatformErrorOverview(actor, {
      window: '1h',
      app: 'platform-admin',
      severity: 'critical',
      limit: 25,
    }, createPlatformErrorReadPort(serviceRpc))
    if (!critical.ok) throw new Error(critical.error)

    const anonRead = await anonRpc('read_platform_admin_error_overview', {
      p_window: '1h',
      p_app: null,
      p_severity: null,
      p_limit: 25,
    })
    const anonWrite = await anonRpc('record_platform_error_event', {
      p_restaurant_id: restaurant.id,
      p_app: 'platform-admin',
      p_source: source,
      p_public_code: 'MAS-SVC-503',
      p_severity: 'error',
      p_reference_id: null,
      p_occurred_at: new Date().toISOString(),
    })
    const invalid = await (service.rpc.bind(service) as unknown as RuntimeRpc)(
      'record_platform_error_event',
      {
        p_restaurant_id: restaurant.id,
        p_app: 'platform-admin',
        p_source: 'customer@example.com SQL failed',
        p_public_code: 'MAS-SVC-503',
        p_severity: 'error',
        p_reference_id: null,
        p_occurred_at: new Date().toISOString(),
      },
    )
    const { data: anonRows, error: anonTableError } = await anon
      .from('platform_error_events')
      .select('id')
      .limit(1)

    const safeKeys = Object.keys(item).sort()
    const forbiddenKeys = ['error', 'message', 'payload', 'stack', 'email', 'phone']
    console.log(JSON.stringify({
      project: new URL(env('NEXT_PUBLIC_SUPABASE_URL')).hostname,
      tenant: { idSuffix: restaurant.id.slice(-6), name: restaurant.name },
      fingerprint: {
        deterministic: firstFingerprint === replayFingerprint,
        valuePrefix: firstFingerprint.slice(0, 8),
        groupedOccurrences: item.occurrenceCount,
        highestSeverity: item.severity,
        affectedTenantCount: item.affectedTenantCount,
        criticalFilterContainsFingerprint: critical.value.items.some(
          (candidate) => candidate.fingerprint === firstFingerprint,
        ),
      },
      publicBoundary: {
        anonReadCode: anonRead.error?.code ?? null,
        anonWriteCode: anonWrite.error?.code ?? null,
        anonTableCode: anonTableError?.code ?? null,
        anonTableRows: anonRows?.length ?? 0,
        invalidInputCode: invalid.error?.code ?? null,
      },
      safeProjection: {
        keys: safeKeys,
        containsForbiddenKey: safeKeys.some((key) => forbiddenKeys.includes(key)),
      },
    }, null, 2))
  } catch (cause) {
    verificationError = cause
  }

  const { error: cleanupError } = await service
    .from('platform_error_events')
    .delete()
    .eq('source', source)
  if (cleanupError) throw cleanupError
  const { count, error: countError } = await service
    .from('platform_error_events')
    .select('*', { count: 'exact', head: true })
    .eq('source', source)
  if (countError) throw countError
  console.log(JSON.stringify({ cleanup: { source, remainingRows: count ?? 0 } }, null, 2))
  if (verificationError) throw verificationError
}

void main()
