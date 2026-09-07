import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
export type FlowGrant = { purpose: 'recovery' | 'complete' | 'sent' | 'oauth'; userId: string; sessionId: string; expiresAt: number; nonce: string }
export function signFlowGrant(input: Omit<FlowGrant, 'nonce' | 'expiresAt'>, secret: string, now = Date.now()): string {
  if (!secret) throw new Error('Auth signing key unavailable')
  const payload = Buffer.from(JSON.stringify({ ...input, nonce: randomUUID(), expiresAt: now + 600_000 })).toString('base64url')
  return payload + '.' + createHmac('sha256', secret).update('masabu-auth-flow:' + payload).digest('base64url')
}
export function readFlowGrant(value: string | undefined, secret: string, purpose: FlowGrant['purpose'], now = Date.now()): FlowGrant | null {
  if (!value || !secret) return null
  try {
    const [payload, signature, extra] = value.split('.')
    if (!payload || !signature || extra) return null
    const expected = createHmac('sha256', secret).update('masabu-auth-flow:' + payload).digest()
    const actual = Buffer.from(signature, 'base64url')
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null
    const grant = JSON.parse(Buffer.from(payload, 'base64url').toString()) as FlowGrant
    return grant.purpose === purpose && grant.expiresAt > now && typeof grant.userId === 'string' && typeof grant.sessionId === 'string' && typeof grant.nonce === 'string' ? grant : null
  } catch { return null }
}
export function sessionIdFromToken(token: string | undefined): string | null {
  // Only call after getUser/verifyOtp validated this client's session.
  try { const claims = JSON.parse(Buffer.from(token?.split('.')[1] ?? '', 'base64url').toString()); return typeof claims.session_id === 'string' ? claims.session_id : null } catch { return null }
}
