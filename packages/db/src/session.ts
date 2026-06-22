// Stateless customer session: a signed JWT carrying IDENTITY ONLY (never
// balances — those go stale). Verified server-side in every loyalty route; the
// menu server component reads it to render member state. NOT a Supabase Auth
// user (too heavy for customers, who are never owners).

import { SignJWT, jwtVerify } from 'jose'

const ISSUER = 'garsonless-menu'
const AUDIENCE = 'garsonless-customer'
const TTL = '60d'

/** httpOnly cookie name; scoped to the menu app only (path '/', the menu origin). */
export const CUSTOMER_SESSION_COOKIE = 'gl_member'

export interface CustomerSession {
  customerId: string
  phone: string
}

function secret(): Uint8Array {
  const s = process.env['CUSTOMER_SESSION_SECRET']
  if (!s) throw new Error('Missing environment variable: CUSTOMER_SESSION_SECRET')
  return new TextEncoder().encode(s)
}

export async function signCustomerSession(session: CustomerSession): Promise<string> {
  return new SignJWT({ phone: session.phone })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(session.customerId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(TTL)
    .sign(secret())
}

export async function verifyCustomerSession(token: string | undefined | null): Promise<CustomerSession | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secret(), { issuer: ISSUER, audience: AUDIENCE })
    const customerId = payload.sub
    const phone = typeof payload['phone'] === 'string' ? payload['phone'] : null
    if (!customerId || !phone) return null
    return { customerId, phone }
  } catch {
    return null // expired / tampered / wrong secret
  }
}
