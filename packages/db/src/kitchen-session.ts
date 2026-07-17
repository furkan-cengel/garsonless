import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { createServiceClient } from './client'

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

export async function hasKitchenCredential(restaurantId: string): Promise<boolean> {
  return (await readKitchenCredential(restaurantId)) !== null
}

export async function createKitchenLaunchTicket(restaurantId: string): Promise<string | null> {
  const secret = await readKitchenCredential(restaurantId)
  if (!secret) return null

  const ticket = signArtifact('launch', restaurantId, secret, KITCHEN_LAUNCH_TTL_SECONDS)
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
  return error ? null : ticket
}

export async function exchangeKitchenLaunchTicket(
  restaurantId: string,
  ticket: string,
): Promise<string | null> {
  const secret = await readKitchenCredential(restaurantId)
  if (!secret || !verifyArtifact(ticket, 'launch', restaurantId, secret)) return null
  const { data: consumed, error } = await createServiceClient().rpc('consume_kitchen_launch_ticket', {
    p_restaurant_id: restaurantId,
    p_ticket_hash: hashArtifact(ticket),
  })
  if (error || consumed !== true) return null
  return signArtifact('session', restaurantId, secret, KITCHEN_SESSION_TTL_SECONDS)
}

export async function verifyKitchenSession(
  restaurantId: string,
  session: string,
): Promise<boolean> {
  const secret = await readKitchenCredential(restaurantId)
  return secret !== null && verifyArtifact(session, 'session', restaurantId, secret)
}

// Pure helpers are intentionally package-private exports for contract tests.
export const kitchenSessionTestKit = { hashArtifact, signArtifact, verifyArtifact }
