import { createHmac, timingSafeEqual } from 'node:crypto'

export function createSignupMarker(userId: string, method: 'email' | 'google', key: string | undefined): string | null {
  if (!key) return null
  const hash = createHmac('sha256', key).update(`signup-analytics:${method}:${userId}`).digest('hex')
  return `${method}:${hash}`
}

export function verifySignupMarker(userId: string, marker: string, key: string | undefined): 'email' | 'google' | null {
  const [method, hash, extra] = marker.split(':')
  if ((method !== 'email' && method !== 'google') || !hash || extra !== undefined || !/^[a-f0-9]{64}$/.test(hash)) return null
  const expected = createSignupMarker(userId, method, key)
  return expected && timingSafeEqual(Buffer.from(marker), Buffer.from(expected)) ? method : null
}
