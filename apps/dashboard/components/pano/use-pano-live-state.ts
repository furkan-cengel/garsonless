'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchPanoSnapshot, fetchPanoTableStatuses } from '../../lib/actions/pano'
import { createDashboardBrowserClient } from '../../lib/supabase'
import type { ActivityEvent, PanoSnapshot, TableStatusData } from '../../lib/queries/pano'
import type { PanoRealtimeStatus } from './pano-view-model'

type PanoLiveSnapshot = Omit<PanoSnapshot, 'timezone' | 'initialFeed' | 'tableStatuses'>

export type PanoLiveState = {
  snapshot: PanoLiveSnapshot
  feed: ActivityEvent[]
  tableStatuses: TableStatusData[]
  realtime: PanoRealtimeStatus
  updatedAt: Date
  refreshSnapshot: () => Promise<void>
  refreshTables: () => Promise<void>
  updateFeedStatus: (orderId: string, status: string) => void
}

/**
 * Owns the Pano's operational state: snapshot refreshes, table refreshes and
 * its single restaurant-scoped realtime channel. The shell only composes the
 * returned state with presentation features.
 */
export function usePanoLiveState({
  restaurantId,
  initialSnapshot,
  initialFeed,
  initialTableStatuses,
}: {
  restaurantId: string
  initialSnapshot: PanoLiveSnapshot
  initialFeed: ActivityEvent[]
  initialTableStatuses: TableStatusData[]
}): PanoLiveState {
  const [snapshot, setSnapshot] = useState<PanoLiveSnapshot>(initialSnapshot)
  const [feed, setFeed] = useState<ActivityEvent[]>(initialFeed)
  const [tableStatuses, setTableStatuses] = useState<TableStatusData[]>(initialTableStatuses)
  const [realtime, setRealtime] = useState<PanoRealtimeStatus>('connecting')
  const [updatedAt, setUpdatedAt] = useState(() => new Date())
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const labelByTableId = useRef<Map<string, string>>(new Map())

  useEffect(() => {
    labelByTableId.current = new Map(tableStatuses.map((table) => [table.id, table.label]))
  }, [tableStatuses])

  const refreshSnapshot = useCallback(async () => {
    const result = await fetchPanoSnapshot(restaurantId)
    if ('error' in result) {
      setSnapshot((current) => ({ ...current, errors: [result.error] }))
      return
    }

    const { timezone: _timezone, initialFeed: nextFeed, tableStatuses: nextTables, ...nextSnapshot } = result.snapshot
    setSnapshot(nextSnapshot)
    setFeed(nextFeed)
    setTableStatuses(nextTables)
    setUpdatedAt(new Date())
  }, [restaurantId])

  const scheduleSnapshotRefresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current)
    refreshTimer.current = setTimeout(() => void refreshSnapshot(), 250)
  }, [refreshSnapshot])

  const refreshTables = useCallback(async () => {
    const result = await fetchPanoTableStatuses(restaurantId)
    if (!('error' in result)) setTableStatuses(result.tables)
  }, [restaurantId])

  const updateFeedStatus = useCallback((orderId: string, status: string) => {
    setFeed((current) => current.map((event) => (
      event.id === orderId ? { ...event, status } : event
    )))
  }, [])

  useEffect(() => {
    const supabase = createDashboardBrowserClient()
    const channel = supabase
      .channel(`orders:${restaurantId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `restaurant_id=eq.${restaurantId}`,
      }, (payload) => {
        scheduleSnapshotRefresh()
        const row = payload.new as { id: string; status: string; total: number; table_id: string | null; created_at: string }
        if (payload.eventType === 'UPDATE') {
          updateFeedStatus(row.id, row.status)
          return
        }
        if (payload.eventType !== 'INSERT') return
        setFeed((current) => [
          {
            id: row.id,
            status: row.status,
            total: row.total,
            tableId: row.table_id,
            tableLabel: row.table_id ? labelByTableId.current.get(row.table_id) ?? null : null,
            createdAt: row.created_at,
          },
          ...current,
        ].slice(0, 7))
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'table_sessions',
        filter: `restaurant_id=eq.${restaurantId}`,
      }, scheduleSnapshotRefresh)
      .subscribe((status) => {
        setRealtime(
          status === 'SUBSCRIBED' ? 'connected'
          : status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED' ? 'down'
          : 'connecting',
        )
      })

    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
      void supabase.removeChannel(channel)
    }
  }, [restaurantId, scheduleSnapshotRefresh, updateFeedStatus])

  return {
    snapshot,
    feed,
    tableStatuses,
    realtime,
    updatedAt,
    refreshSnapshot,
    refreshTables,
    updateFeedStatus,
  }
}
