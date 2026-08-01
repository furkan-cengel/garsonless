'use client'

import { useCallback, useEffect, useState } from 'react'
import type { TablesRealtimeStatus } from './tables-realtime-model'
import type { TablesRealtimeRuntimeInput } from './tables-realtime-channel-runtime'

type Refresh = () => Promise<boolean>

export function useTablesRealtimeChannel(input: Omit<TablesRealtimeRuntimeInput, 'setConnectionStatus'> & {
  reconcile: Refresh
  refreshSessions: Refresh
  refreshPendingRequests: Refresh
  refreshTableDirectory: Refresh
}) {
  const {
    restaurantId, reconcile, refreshSessions, refreshPendingRequests,
    refreshTableDirectory, onLayoutInvalidated,
  } = input
  const [connectionStatus, setConnectionStatus] = useState<TablesRealtimeStatus>('connecting')
  const [subscriptionGeneration, setSubscriptionGeneration] = useState(0)
  const retryRealtime = useCallback(() => {
    setConnectionStatus('reconnecting')
    setSubscriptionGeneration((generation) => generation + 1)
  }, [])

  useEffect(() => {
    let disposed = false
    let stop: (() => void) | null = null
    void import('./tables-realtime-channel-runtime').then(({ startTablesRealtimeRuntime }) => {
      if (disposed) return
      stop = startTablesRealtimeRuntime({
        restaurantId, reconcile, refreshSessions, refreshPendingRequests,
        refreshTableDirectory, onLayoutInvalidated, setConnectionStatus, retryRealtime,
      })
    }).catch(() => {
      if (!disposed) setConnectionStatus('offline')
    })
    return () => {
      disposed = true
      stop?.()
    }
  }, [onLayoutInvalidated, reconcile, refreshPendingRequests, refreshSessions, refreshTableDirectory, restaurantId, retryRealtime, subscriptionGeneration])

  return { connectionStatus, retryRealtime }
}
