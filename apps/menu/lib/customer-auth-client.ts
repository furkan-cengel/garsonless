'use client'

import type { ApiResult, CustomerSessionView } from './customer-auth-contract'

const CHANNEL_NAME = 'masabu-customer-session-v1'

export type CustomerSessionEvent = 'signed-in' | 'signed-out' | 'session-expired'

export function broadcastCustomerSessionEvent(event: CustomerSessionEvent): void {
  if (typeof BroadcastChannel === 'undefined') return
  const channel = new BroadcastChannel(CHANNEL_NAME)
  channel.postMessage({ event, at: Date.now() })
  channel.close()
}

export function subscribeToCustomerSession(
  listener: (event: CustomerSessionEvent) => void,
): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => undefined
  const channel = new BroadcastChannel(CHANNEL_NAME)
  channel.onmessage = (message: MessageEvent<unknown>) => {
    const event = (message.data as { event?: unknown } | null)?.event
    if (event === 'signed-in' || event === 'signed-out' || event === 'session-expired') listener(event)
  }
  return () => channel.close()
}

export async function fetchCustomerSession(): Promise<CustomerSessionView | null> {
  try {
    const response = await fetch('/api/account/session', {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!response.ok) return null
    const result = await response.json() as ApiResult<CustomerSessionView>
    return result.ok ? result.data : null
  } catch {
    return null
  }
}
