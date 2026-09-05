'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { OpenTableSessionView, TableItem } from './tables-builder-types'
import {
  activeOperationalFilterCount,
  filterOperationalTables,
  operationalStateCounts,
  tableLocationOptions,
  type TableOperationalFilter,
} from './tables-operation-model'
import { realtimeStatusTone, type TablesRealtimeStatus } from './tables-realtime-model'
export function useOperationalNow(initialNow: number) {
  const [now, setNow] = useState(initialNow)
  useEffect(() => {
    let timer: number | null = null
    const schedule = () => {
      if (timer !== null) window.clearTimeout(timer)
      const current = Date.now(), nextMinute = 60_000 - (current % 60_000) + 25
      timer = window.setTimeout(() => {
        if (document.visibilityState === 'visible') setNow(Date.now())
        schedule()
      }, nextMinute)
    }
    const update = () => {
      if (document.visibilityState === 'visible') setNow(Date.now())
      schedule()
    }
    schedule()
    window.addEventListener('focus', update)
    document.addEventListener('visibilitychange', update)
    return () => {
      if (timer !== null) window.clearTimeout(timer)
      window.removeEventListener('focus', update)
      document.removeEventListener('visibilitychange', update)
    }
  }, [])
  return now
}
export function useTablesNavigationModel({
  tables,
  openSessions,
  query,
  setQuery,
  connectionStatus,
  now,
}: {
  tables: TableItem[]
  openSessions: Record<string, OpenTableSessionView>
  query: string
  setQuery: (query: string) => void
  connectionStatus: TablesRealtimeStatus
  now: number
}) {
  const [statusFilter, setStatusFilter] = useState<TableOperationalFilter>('all')
  const [floorFilter, setFloorFilter] = useState('')
  const [areaFilter, setAreaFilter] = useState('')
  const stateCounts = useMemo(
    () => operationalStateCounts(tables, openSessions, now),
    [now, openSessions, tables],
  )
  const floorOptions = useMemo(() => tableLocationOptions(tables, 'floorLabel'), [tables])
  const areaOptions = useMemo(() => tableLocationOptions(tables, 'areaLabel'), [tables])
  const filteredTables = useMemo(
    () => filterOperationalTables(tables, openSessions, {
      query,
      state: statusFilter,
      floorLabel: floorFilter,
      areaLabel: areaFilter,
    }, now),
    [areaFilter, floorFilter, now, openSessions, query, statusFilter, tables],
  )
  const filtersActive = Boolean(query.trim() || statusFilter !== 'all' || floorFilter || areaFilter)
  const activeFilterCount = activeOperationalFilterCount({
    query,
    state: statusFilter,
    floorLabel: floorFilter,
    areaLabel: areaFilter,
  })
  const activeCount = stateCounts.new + stateCounts.open + stateCounts.late + stateCounts.stale + stateCounts.paid
  const realtimeTone = realtimeStatusTone(connectionStatus)
  const realtimeColor = realtimeTone === 'positive'
    ? 'var(--positive)'
    : realtimeTone === 'critical'
      ? 'var(--critical)'
      : 'var(--warning)'
  const realtimeBackground = realtimeTone === 'positive'
    ? 'var(--positive-bg)'
    : realtimeTone === 'critical'
      ? 'var(--critical-bg)'
      : 'var(--warning-bg)'

  const clearFilters = useCallback(() => {
    setQuery('')
    setStatusFilter('all')
    setFloorFilter('')
    setAreaFilter('')
  }, [setQuery])

  return {
    now,
    statusFilter,
    setStatusFilter,
    floorFilter,
    setFloorFilter,
    areaFilter,
    setAreaFilter,
    stateCounts,
    floorOptions,
    areaOptions,
    filteredTables,
    filtersActive,
    activeFilterCount,
    activeCount,
    realtimeColor,
    realtimeBackground,
    clearFilters,
  }
}
