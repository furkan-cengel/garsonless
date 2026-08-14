import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { createClient } from '@supabase/supabase-js'
import {
  endPlatformImpersonationSession,
  readPlatformImpersonationSession,
  startPlatformImpersonationSession,
  type PlatformImpersonationPort,
} from '@garsonless/application/platform-admin-impersonation'
import type { PlatformAdminActorContext } from '@garsonless/domain/platform-admin'
import { createServiceClient } from '../src/client'
import { createPlatformAdminImpersonationPort } from '../src/platform-admin-impersonation-port'
import type { Database } from '../src/types.gen'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function env(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing environment variable: ${name}`)
  return value
}

type RawRpc = (
  name: 'start_platform_admin_impersonation_session',
  args: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>

const service = createServiceClient()
const suffix = randomUUID().slice(0, 8)
let restaurantId = ''
const sessionIds: string[] = []

async function main() {
  let primaryError: unknown = null
  let immutableAuditRows = 0
  let stage = 'fixture'
  try {
    const [{ data: fixture, error: fixtureError }, { data: identity, error: identityError }] = await Promise.all([
      service.from('restaurants').select('owner_id').eq('slug', 'test-cafe-b').single(),
      service.from('platform_admin_users').select('user_id, role, status').eq('role', 'superadmin').eq('status', 'active').limit(1).single(),
    ])
    if (fixtureError || !fixture?.owner_id) throw fixtureError ?? new Error('Test Cafe B fixture unavailable')
    if (identityError || !identity) throw identityError ?? new Error('Active superadmin unavailable')
    const actor: PlatformAdminActorContext = {
      actor: 'platform-admin', userId: identity.user_id, role: 'superadmin', aal: 'aal2',
    }
    const { data: restaurant, error: restaurantError } = await service.from('restaurants').insert({
      owner_id: fixture.owner_id,
      slug: `platform-support-view-${suffix}`,
      name: `Platform support view ${suffix}`,
      plan: 'starter',
    }).select('id').single()
    if (restaurantError || !restaurant) throw restaurantError ?? new Error('Throwaway tenant unavailable')
    restaurantId = restaurant.id

    stage = 'finance-application-denial'
    let deniedPortCalls = 0
    const deniedPort: PlatformImpersonationPort = {
      async readSession() { throw new Error('unused') },
      async startSession() {
        deniedPortCalls += 1
        throw new Error('Finance reached persistence')
      },
      async endSession() { throw new Error('unused') },
    }
    const denied = await startPlatformImpersonationSession({ ...actor, role: 'finance' }, {
      restaurantId,
      durationMinutes: 30,
      reason: 'Finance rolü destek görünümü açamaz.',
      requestId: randomUUID(),
    }, deniedPort)
    assert(!denied.ok && denied.error === 'Not authorized' && deniedPortCalls === 0, 'Finance reached persistence')

    stage = 'forged-role-database-denial'
    const rawRpc = service.rpc.bind(service) as unknown as RawRpc
    const forged = await rawRpc('start_platform_admin_impersonation_session', {
      p_restaurant_id: restaurantId,
      p_actor_user_id: actor.userId,
      p_actor_role: 'support',
      p_duration_minutes: 30,
      p_reason: 'Forged role must be rejected by database.',
      p_request_id: randomUUID(),
    })
    assert(forged.error?.code === '42501', 'Database accepted forged role')

    stage = 'anonymous-database-denial'
    const anon = createClient<Database>(env('NEXT_PUBLIC_SUPABASE_URL'), env('NEXT_PUBLIC_SUPABASE_ANON_KEY'), {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const anonRpc = anon.rpc.bind(anon) as unknown as RawRpc
    const anonResult = await anonRpc('start_platform_admin_impersonation_session', {
      p_restaurant_id: restaurantId,
      p_actor_user_id: actor.userId,
      p_actor_role: actor.role,
      p_duration_minutes: 30,
      p_reason: 'Anonymous caller must be rejected by database.',
      p_request_id: randomUUID(),
    })
    assert(anonResult.error?.code === '42501', 'Anonymous caller reached session RPC')
    const { error: anonTableError } = await anon.from('platform_admin_impersonation_sessions').select('id').eq('restaurant_id', restaurantId)
    assert(anonTableError?.code === '42501', 'Anonymous caller read support sessions')

    stage = 'start-session'
    const port = createPlatformAdminImpersonationPort()
    const startRequestId = randomUUID()
    const started = await startPlatformImpersonationSession(actor, {
      restaurantId,
      durationMinutes: 30,
      reason: 'Gerçek destek vakası için salt okunur tenant incelemesi.',
      requestId: startRequestId,
    }, port)
    assert(started.ok && started.value.session.status === 'active', 'Support session did not start')
    sessionIds.push(started.value.session.id)

    stage = 'start-replay'
    const replay = await startPlatformImpersonationSession(actor, {
      restaurantId,
      durationMinutes: 30,
      reason: 'Gerçek destek vakası için salt okunur tenant incelemesi.',
      requestId: startRequestId,
    }, port)
    assert(replay.ok && replay.value.duplicate && replay.value.session.id === started.value.session.id, 'Start replay was not idempotent')
    stage = 'overlapping-session-denial'
    const overlapping = await startPlatformImpersonationSession(actor, {
      restaurantId,
      durationMinutes: 15,
      reason: 'İkinci eşzamanlı oturum güvenli biçimde reddedilmeli.',
      requestId: randomUUID(),
    }, port)
    assert(!overlapping.ok, 'Overlapping session was accepted')

    stage = 'active-session-read'
    const active = await readPlatformImpersonationSession(actor, started.value.session.id, port)
    assert(active.ok && active.value?.status === 'active' && active.value.restaurantId === restaurantId, 'Active session read failed')
    const { count: membershipCount, error: membershipError } = await service.from('restaurant_members')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
      .eq('user_id', actor.userId)
    if (membershipError) throw membershipError
    assert(membershipCount === 0, 'Support view created a tenant membership')

    stage = 'end-session'
    const endRequestId = randomUUID()
    const ended = await endPlatformImpersonationSession(actor, {
      sessionId: started.value.session.id,
      reason: 'Destek incelemesi tamamlandı ve oturum kapatıldı.',
      requestId: endRequestId,
    }, port)
    assert(ended.ok && ended.value.session.status === 'ended', 'Session did not end')
    stage = 'end-replay'
    const endReplay = await endPlatformImpersonationSession(actor, {
      sessionId: started.value.session.id,
      reason: 'Destek incelemesi tamamlandı ve oturum kapatıldı.',
      requestId: endRequestId,
    }, port)
    assert(endReplay.ok && endReplay.value.duplicate, 'End replay was not idempotent')

    stage = 'expiry-session-start'
    const expiryRequestId = randomUUID()
    const expiring = await startPlatformImpersonationSession(actor, {
      restaurantId,
      durationMinutes: 15,
      reason: 'Süre dolumu davranışını doğrulayan salt okunur oturum.',
      requestId: expiryRequestId,
    }, port)
    assert(expiring.ok, 'Expiring session did not start')
    sessionIds.push(expiring.value.session.id)
    const forcedExpiryAt = Date.parse(expiring.value.session.startedAt) + 1_000
    stage = 'expiry-session-shortening'
    const { error: expiryError } = await service.from('platform_admin_impersonation_sessions')
      .update({ expires_at: new Date(forcedExpiryAt).toISOString() })
      .eq('id', expiring.value.session.id)
    if (expiryError) throw expiryError
    await delay(Math.max(0, forcedExpiryAt - Date.now()) + 250)
    stage = 'expiry-session-read'
    const expired = await readPlatformImpersonationSession(actor, expiring.value.session.id, port)
    assert(expired.ok && expired.value?.status === 'expired', 'Expired session remained active')

    stage = 'audit-evidence'
    const auditRequestIds = [startRequestId, endRequestId, expiryRequestId]
    const { count: auditRows, error: auditError } = await service.from('platform_admin_audit_log')
      .select('id', { count: 'exact', head: true })
      .in('request_id', auditRequestIds)
    if (auditError) throw auditError
    immutableAuditRows = auditRows ?? -1
    assert(immutableAuditRows === 3, 'Replay wrote duplicate audit rows')

    console.log(JSON.stringify({
      project: new URL(env('NEXT_PUBLIC_SUPABASE_URL')).hostname,
      authorization: {
        financeDenied: denied,
        persistenceCalls: deniedPortCalls,
        forgedRoleCode: forged.error?.code,
        anonRpcCode: anonResult.error?.code,
        anonTableCode: anonTableError.code,
      },
      session: {
        started: started.ok,
        replayDuplicate: replay.ok && replay.value.duplicate,
        overlappingRejected: !overlapping.ok,
        activeRead: active.ok && active.value?.status,
        membershipRows: membershipCount,
      },
      end: { ended: ended.ok, replayDuplicate: endReplay.ok && endReplay.value.duplicate },
      expiry: { status: expired.ok ? expired.value?.status : 'error' },
      immutableAuditEvidence: immutableAuditRows,
    }, null, 2))
  } catch (error) {
    const detail = error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : error
    primaryError = new Error(`Runtime verification failed at ${stage}: ${JSON.stringify(detail)}`)
    console.error(JSON.stringify({ stage, error: detail }, null, 2))
  }

  if (sessionIds.length) {
    const { error } = await service.from('platform_admin_impersonation_sessions').delete().in('id', sessionIds)
    if (error) throw error
  }
  if (restaurantId) {
    const { error } = await service.from('restaurants').delete().eq('id', restaurantId)
    if (error) throw error
  }
  const marker = restaurantId || randomUUID()
  const [{ count: sessions, error: sessionError }, { count: restaurants, error: restaurantError }] = await Promise.all([
    service.from('platform_admin_impersonation_sessions').select('id', { count: 'exact', head: true }).eq('restaurant_id', marker),
    service.from('restaurants').select('id', { count: 'exact', head: true }).eq('id', marker),
  ])
  if (sessionError || restaurantError) throw sessionError ?? restaurantError
  assert(sessions === 0 && restaurants === 0, 'Runtime cleanup left mutable rows')
  console.log(JSON.stringify({ cleanup: { sessions, restaurants }, immutableAuditEvidence: immutableAuditRows }))
  if (primaryError) throw primaryError
}

void main()
