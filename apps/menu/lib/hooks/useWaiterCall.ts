'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ServiceRequestType } from '@garsonless/db/order-client'

export type WaiterCallState = 'idle' | 'calling' | 'called'

const COOLDOWN_MS = 90_000

/**
 * Shared waiter-call logic for the menu app. After a successful (or throttled)
 * call the button stays in 'called' for 90s, matching the server-side throttle.
 */
export function useWaiterCall(restaurantId: string, tableId: string | null) {
  const [callState, setCallState] = useState<WaiterCallState>('idle')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  const sendServiceRequest = useCallback(async (requestType: ServiceRequestType) => {
    if (!tableId) return false
    if (requestType === 'waiter') {
      if (callState === 'called') return true
      if (callState !== 'idle') return false
      setCallState('calling')
    }
    try {
      const res = await fetch('/api/service-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId, tableId, requestType }),
      })
      const data = (await res.json()) as { ok: boolean }
      if (data.ok) {
        if (requestType === 'waiter') {
          setCallState('called')
          if (timerRef.current) clearTimeout(timerRef.current)
          timerRef.current = setTimeout(() => setCallState('idle'), COOLDOWN_MS)
        }
        return true
      } else {
        if (requestType === 'waiter') setCallState('idle')
        return false
      }
    } catch {
      if (requestType === 'waiter') setCallState('idle')
      return false
    }
  }, [restaurantId, tableId, callState])

  const callWaiter = useCallback(
    () => sendServiceRequest('waiter'),
    [sendServiceRequest],
  )

  return { callState, callWaiter, sendServiceRequest }
}
