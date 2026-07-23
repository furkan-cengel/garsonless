import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { normalizeRestaurantPlan, type RestaurantPlan } from '@garsonless/domain'
import { createServiceClient } from './client'
import { canRestaurantUseFeature } from './feature-entitlement-port'

const ARTIFACT_VERSION = 1
const CLOCK_SKEW_SECONDS = 30

export const KITCHEN_LAUNCH_TTL_SECONDS = 45
export const KITCHEN_SESSION_TTL_SECONDS = 8 * 60 * 60

type KitchenArtifactKind = 'launch' | 'session'

interface KitchenArtifactPayload {
  v: number
  kind: KitchenArtifactKind
  restaurantId: string
  issuedAt: number
  expiresAt: number
  nonce: string
}

function encodePayload(payload: KitchenArtifactPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
}

function signatureFor(encodedPayload: string, secret: string): Buffer {
  return createHmac('sha256', secret)
    .update(`masabu:kitchen:${encodedPayload}`)
    .digest()
}

function hashArtifact(artifact: string): string {
  return createHash('sha256').update(artifact).digest('hex')
}

function signArtifact(
  kind: KitchenArtifactKind,
  restaurantId: string,
  secret: string,
  ttlSeconds: number,
  nowSeconds = Math.floor(Date.now() / 1000),
): string {
  const encodedPayload = encodePayload({
    v: ARTIFACT_VERSION,
    kind,
    restaurantId,
    issuedAt: nowSeconds,
    expiresAt: nowSeconds + ttlSeconds,
    nonce: randomUUID(),
  })
  return `${encodedPayload}.${signatureFor(encodedPayload, secret).toString('base64url')}`
}

function isPayload(value: unknown): value is KitchenArtifactPayload {
  if (!value || typeof value !== 'object') return false
  const payload = value as Record<string, unknown>
  return payload['v'] === ARTIFACT_VERSION
    && (payload['kind'] === 'launch' || payload['kind'] === 'session')
    && typeof payload['restaurantId'] === 'string'
    && typeof payload['issuedAt'] === 'number'
    && Number.isInteger(payload['issuedAt'])
    && typeof payload['expiresAt'] === 'number'
    && Number.isInteger(payload['expiresAt'])
    && typeof payload['nonce'] === 'string'
}

function verifyArtifact(
  artifact: string,
  expectedKind: KitchenArtifactKind,
  restaurantId: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  const [encodedPayload, encodedSignature, extra] = artifact.split('.')
  if (!encodedPayload || !encodedSignature || extra) return false

  let suppliedSignature: Buffer
  let payload: unknown
  try {
    suppliedSignature = Buffer.from(encodedSignature, 'base64url')
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as unknown
  } catch {
    return false
  }

  const expectedSignature = signatureFor(encodedPayload, secret)
  if (suppliedSignature.length !== expectedSignature.length) return false
  if (!timingSafeEqual(suppliedSignature, expectedSignature)) return false
  if (!isPayload(payload)) return false

  return payload.kind === expectedKind
    && payload.restaurantId === restaurantId
    && payload.issuedAt <= nowSeconds + CLOCK_SKEW_SECONDS
    && payload.expiresAt > nowSeconds
}

async function readKitchenCredential(restaurantId: string): Promise<string | null> {
  const { data, error } = await createServiceClient()
    .from('kitchen_credentials')
    .select('token')
    .eq('restaurant_id', restaurantId)
    .maybeSingle()
  if (error || !data) return null
  return (data as { token: string }).token
}

type KitchenAccess = { secret: string; plan: RestaurantPlan }

async function readKitchenAccess(restaurantId: string): Promise<KitchenAccess | null> {
  const service = createServiceClient()
  const [credential, restaurant] = await Promise.all([
    service
      .from('kitchen_credentials')
      .select('token')
      .eq('restaurant_id', restaurantId)
      .maybeSingle(),
    service
      .from('restaurants')
      .select('plan')
      .eq('id', restaurantId)
      .maybeSingle(),
  ])
  if (credential.error || restaurant.error || !credential.data || !restaurant.data) return null
  return {
    secret: (credential.data as { token: string }).token,
    plan: normalizeRestaurantPlan((restaurant.data as { plan: unknown }).plan),
  }
}

export async function hasKitchenCredential(restaurantId: string): Promise<boolean> {
  return (await readKitchenCredential(restaurantId)) !== null
}

export type KitchenLaunchTicketResult =
  | { kind: 'created'; ticket: string }
  | { kind: 'plan_required' }
  | { kind: 'credential_missing' }
  | { kind: 'unavailable' }

export async function createKitchenLaunchTicket(
  restaurantId: string,
): Promise<KitchenLaunchTicketResult> {
  const access = await readKitchenAccess(restaurantId)
  if (!access) {
    const credential = await readKitchenCredential(restaurantId)
    return credential ? { kind: 'unavailable' } : { kind: 'credential_missing' }
  }
  if (!await canRestaurantUseFeature({ restaurantId, plan: access.plan, feature: 'kitchen_display' })) {
    return { kind: 'plan_required' }
  }

  const ticket = signArtifact('launch', restaurantId, access.secret, KITCHEN_LAUNCH_TTL_SECONDS)
  const service = createServiceClient()
  const now = new Date()
  // Opportunistic tenant-scoped housekeeping; failure does not weaken the
  // unique receipt insert or the atomic consume guard below.
  await service.from('kitchen_session_launches')
    .delete()
    .eq('restaurant_id', restaurantId)
    .lt('expires_at', now.toISOString())

  const { error } = await service.from('kitchen_session_launches').insert({
    restaurant_id: restaurantId,
    ticket_hash: hashArtifact(ticket),
    expires_at: new Date(now.getTime() + KITCHEN_LAUNCH_TTL_SECONDS * 1_000).toISOString(),
  })
  return error ? { kind: 'unavailable' } : { kind: 'created', ticket }
}

export async function exchangeKitchenLaunchTicket(
  restaurantId: string,
  ticket: string,
): Promise<string | null> {
  const access = await readKitchenAccess(restaurantId)
  if (!access || !await canRestaurantUseFeature({ restaurantId, plan: access.plan, feature: 'kitchen_display' })) return null
  if (!verifyArtifact(ticket, 'launch', restaurantId, access.secret)) return null
  const { data: consumed, error } = await createServiceClient().rpc('consume_kitchen_launch_ticket', {
    p_restaurant_id: restaurantId,
    p_ticket_hash: hashArtifact(ticket),
  })
  if (error || consumed !== true) return null
  return signArtifact('session', restaurantId, access.secret, KITCHEN_SESSION_TTL_SECONDS)
}

export async function verifyKitchenSession(
  restaurantId: string,
  session: string,
): Promise<boolean> {
  const access = await readKitchenAccess(restaurantId)
  return access !== null
    && await canRestaurantUseFeature({ restaurantId, plan: access.plan, feature: 'kitchen_display' })
    && verifyArtifact(session, 'session', restaurantId, access.secret)
}

// Pure helpers are intentionally package-private exports for contract tests.
export const kitchenSessionTestKit = { hashArtifact, signArtifact, verifyArtifact }
