import { headers } from 'next/headers'

export interface RequestMeta {
  ip: string | null
  userAgent: string | null
}

/**
 * Pure: extract the client IP from a forwarded-header pair. `x-forwarded-for`
 * is a comma-separated chain ("client, proxy1, proxy2"); the first entry is the
 * originating client. Falls back to `x-real-ip`. Pure so it can be unit-tested
 * without a request context.
 */
export function parseForwardedIp(forwardedFor: string | null, realIp: string | null): string | null {
  if (forwardedFor) {
    const first = forwardedFor.split(',')[0]?.trim()
    if (first) return first
  }
  const real = realIp?.trim()
  return real ? real : null
}

/** Read IP + user-agent from the current request headers (server context). */
export async function readRequestMeta(): Promise<RequestMeta> {
  const h = await headers()
  return {
    ip: parseForwardedIp(h.get('x-forwarded-for'), h.get('x-real-ip')),
    userAgent: h.get('user-agent'),
  }
}
