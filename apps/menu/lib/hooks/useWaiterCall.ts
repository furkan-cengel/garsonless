'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ServiceRequestType } from '@garsonless/domain/tables'

export type WaiterCallState = 'idle' | 'calling' | 'called'

const COOLDOWN_MS = 90_000

/**
 * Shared waiter-call logic for the menu app. After a successful (or throttled)
 * call the button stays in 'called' for 90s, matching the server-side throttle.
 * Every user action still reaches the server: mobile browsers can suspend the
 * reset timer while the PWA is backgrounded, so client state is never allowed
 * to claim a successful delivery on its own.
 */
export function useWaiterCall(tableToken: string | null) {
  const [callState, setCallState] = useState<WaiterCallState>('idle')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  const sendServiceRequest = useCallback(async (requestType: ServiceRequestType) => {
    if (!tableToken) return false
    if (requestType === 'waiter') {
      if (callState === 'calling') return false
      setCallState('calling')
    }
    try {
      const res = await fetch('/api/service-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableToken, requestType }),
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
  }, [tableToken, callState])

  const callWaiter = useCallback(
    () => sendServiceRequest('waiter'),
    [sendServiceRequest],
  )

  return { callState, callWaiter, sendServiceRequest }
}
