'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

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

  const callWaiter = useCallback(async () => {
    if (!tableId) return false
    if (callState === 'called') return true
    if (callState !== 'idle') return false
    setCallState('calling')
    try {
      const res = await fetch('/api/service-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId, tableId }),
      })
      const data = (await res.json()) as { ok: boolean }
      if (data.ok) {
        setCallState('called')
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => setCallState('idle'), COOLDOWN_MS)
        return true
      } else {
        setCallState('idle')
        return false
      }
    } catch {
      setCallState('idle')
      return false
    }
  }, [restaurantId, tableId, callState])

  return { callState, callWaiter }
}
