'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type MenuLiveStatus = 'connecting' | 'live' | 'offline'

const MENU_INVALIDATION_DEBOUNCE_MS = 350

/**
 * Listens only to the tenant-scoped invalidation boundary. Realtime payloads
 * never become UI state: they trigger an authoritative server refresh when the
 * editor is clean, or a non-destructive update notice while a draft is open.
 */
export function useMenuLiveState({
  restaurantId,
  hasUnsavedChanges,
  onRefresh,
}: {
  restaurantId: string
  hasUnsavedChanges: boolean
  onRefresh: () => void
}) {
  const [status, setStatus] = useState<MenuLiveStatus>('connecting')
  const [updatePending, setUpdatePending] = useState(false)
  const [channelAttempt, setChannelAttempt] = useState(0)
  const refreshTimer = useRef<number | null>(null)
  const reconnectTimer = useRef<number | null>(null)
  const hasSubscribed = useRef(false)
  const dirtyRef = useRef(hasUnsavedChanges)
  const refreshRef = useRef(onRefresh)

  useEffect(() => { dirtyRef.current = hasUnsavedChanges }, [hasUnsavedChanges])
  useEffect(() => { refreshRef.current = onRefresh }, [onRefresh])

  const requestRefresh = useCallback(() => {
    if (dirtyRef.current) {
      setUpdatePending(true)
      return
    }
    setUpdatePending(false)
    refreshRef.current()
  }, [])

  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current !== null) window.clearTimeout(refreshTimer.current)
    refreshTimer.current = window.setTimeout(() => {
      refreshTimer.current = null
      requestRefresh()
    }, MENU_INVALIDATION_DEBOUNCE_MS)
  }, [requestRefresh])

  useEffect(() => {
    if (!hasUnsavedChanges && updatePending) requestRefresh()
  }, [hasUnsavedChanges, requestRefresh, updatePending])

  useEffect(() => {
    let disposed = false
    let removeChannel: (() => void) | null = null
    setStatus(navigator.onLine ? 'connecting' : 'offline')
    const scheduleReconnect = () => {
      if (disposed || !navigator.onLine || reconnectTimer.current !== null) return
      reconnectTimer.current = window.setTimeout(() => {
        reconnectTimer.current = null
        if (!disposed) setChannelAttempt((current) => current + 1)
      }, 3000)
    }

    async function connect() {
      if (!navigator.onLine) return
      const { createDashboardBrowserClient } = await import('../../lib/supabase')
      if (disposed) return
      const supabase = createDashboardBrowserClient()
      const channel = supabase
        .channel(`menu:${restaurantId}:${channelAttempt}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'menu_invalidations',
          filter: `restaurant_id=eq.${restaurantId}`,
        }, scheduleRefresh)
        .subscribe((channelStatus) => {
          if (disposed) return
          if (channelStatus === 'SUBSCRIBED') {
            const reconnect = hasSubscribed.current
            hasSubscribed.current = true
            setStatus('live')
            if (reconnect) scheduleRefresh()
          } else if (channelStatus === 'CHANNEL_ERROR' || channelStatus === 'TIMED_OUT' || channelStatus === 'CLOSED') {
            setStatus('offline')
            scheduleReconnect()
          } else {
            setStatus('connecting')
          }
        })
      removeChannel = () => { void supabase.removeChannel(channel) }
    }

    void connect().catch(() => {
      if (!disposed) {
        setStatus('offline')
        scheduleReconnect()
      }
    })

    const handleOffline = () => setStatus('offline')
    const handleOnline = () => {
      if (reconnectTimer.current !== null) window.clearTimeout(reconnectTimer.current)
      reconnectTimer.current = null
      setStatus('connecting')
      setChannelAttempt((current) => current + 1)
    }
    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    return () => {
      disposed = true
      if (refreshTimer.current !== null) window.clearTimeout(refreshTimer.current)
      refreshTimer.current = null
      if (reconnectTimer.current !== null) window.clearTimeout(reconnectTimer.current)
      reconnectTimer.current = null
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
      removeChannel?.()
    }
  }, [channelAttempt, restaurantId, scheduleRefresh])

  const retry = useCallback(() => {
    setStatus('connecting')
    setChannelAttempt((current) => current + 1)
    requestRefresh()
  }, [requestRefresh])

  return { status, updatePending, retry, refresh: requestRefresh }
}
